import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./firebase/config";
import { Property, Tenant, RentPeriod, Expense, Reminder, Document as AppDocument, RentPayment } from "./types";

// Properties
export const addProperty = async (property: Property) => {
  const docRef = await addDoc(collection(db, "properties"), property);
  return docRef.id;
};

export const getPropertiesByUser = async (userId: string): Promise<Property[]> => {
  const q = query(collection(db, "properties"), where("userId", "==", userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
};

export const groupPropertiesByOwner = (properties: Property[]) => {
  return properties.reduce((acc, property) => {
    const owner = property.ownerName || "לא מוגדר";
    if (!acc[owner]) acc[owner] = [];
    acc[owner].push(property);
    return acc;
  }, {} as Record<string, Property[]>);
};

export const updateProperty = async (id: string, data: Partial<Property>) => {
  const docRef = doc(db, "properties", id);
  const updates = data;
  await updateDoc(docRef, updates);
};

export const deleteExpense = async (id: string) => {
  const docRef = doc(db, "expenses", id);
  await deleteDoc(docRef);
};

// Storage & Documents
export const uploadDocumentFile = async (userId: string, file: File): Promise<string> => {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const storageRef = ref(storage, `users/${userId}/documents/${timestamp}_${safeName}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

export const addDocumentRecord = async (docData: AppDocument) => {
  return addDoc(collection(db, "documents"), docData);
};

export const getDocumentsByProperty = async (propertyId: string): Promise<AppDocument[]> => {
  const q = query(collection(db, "documents"), where("propertyId", "==", propertyId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppDocument));
};

const safelyDeleteStorageUrl = async (url: string | undefined) => {
  if (!url) return;
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch (err) {
    console.error("Failed to delete file from storage:", url, err);
  }
};

export const deleteProperty = async (id: string) => {
  // 1. Delete all expenses and their files
  const expenses = await getExpensesByProperty(id);
  for (const exp of expenses) {
    await safelyDeleteStorageUrl(exp.receiptUrl);
    if (exp.id) await deleteDoc(doc(db, "expenses", exp.id));
  }

  // 2. Delete all documents directly attached to the property
  const docs = await getDocumentsByProperty(id);
  for (const d of docs) {
    await safelyDeleteStorageUrl(d.url);
    if (d.id) await deleteDoc(doc(db, "documents", d.id));
  }

  // 3. Delete all tenants and their rent periods
  const tenants = await getTenantsByProperty(id);
  for (const t of tenants) {
    if (t.id) await deleteTenant(t.id);
  }

  // Finally, delete the property itself
  await deleteDoc(doc(db, "properties", id));
};

export const deleteTenant = async (id: string) => {
  // Delete all rent periods and their files
  const periods = await getRentPeriodsByTenant(id);
  for (const p of periods) {
    await safelyDeleteStorageUrl(p.documentUrl);
    if (p.id) await deleteDoc(doc(db, "rentPeriods", p.id));
  }
  await deleteDoc(doc(db, "tenants", id));
};

// Tenants
export async function addTenant(tenant: Tenant): Promise<string> {
  const docRef = await addDoc(collection(db, "tenants"), {
    ...tenant,
    paymentDueDay: tenant.paymentDueDay || null,
    createdAt: tenant.createdAt || new Date().toISOString()
  });
  return docRef.id;
};

export const getTenantsByProperty = async (propertyId: string): Promise<Tenant[]> => {
  const q = query(collection(db, "tenants"), where("propertyId", "==", propertyId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tenant));
};

export const getTenantById = async (id: string): Promise<Tenant | null> => {
  const docSnap = await getDoc(doc(db, "tenants", id));
  if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() } as Tenant;
  return null;
};

export const updateTenant = async (id: string, data: Partial<Tenant>) => {
  const docRef = doc(db, "tenants", id);
  await updateDoc(docRef, data);
};

// Rent Periods
export const addRentPeriod = async (period: RentPeriod) => {
  const docRef = await addDoc(collection(db, "rentPeriods"), period);
  return docRef.id;
};

export const getRentPeriodsByTenant = async (tenantId: string): Promise<RentPeriod[]> => {
  const q = query(collection(db, "rentPeriods"), where("tenantId", "==", tenantId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RentPeriod));
};

export const getRentPeriodById = async (id: string): Promise<RentPeriod | null> => {
  const docSnap = await getDoc(doc(db, "rentPeriods", id));
  if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() } as RentPeriod;
  return null;
};

export const updateRentPeriod = async (id: string, data: Partial<RentPeriod>) => {
  const docRef = doc(db, "rentPeriods", id);
  await updateDoc(docRef, data);
};

export const deleteRentPeriod = async (id: string, documentUrl?: string) => {
  await safelyDeleteStorageUrl(documentUrl);
  await deleteDoc(doc(db, "rentPeriods", id));
};

// Expenses
export const addExpense = async (expense: Expense) => {
  const docRef = await addDoc(collection(db, "expenses"), expense);
  return docRef.id;
};

export const getExpensesByProperty = async (propertyId: string): Promise<Expense[]> => {
  const q = query(collection(db, "expenses"), where("propertyId", "==", propertyId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
};

// Rent Payments
export const addRentPayment = async (payment: Omit<RentPayment, 'id'>) => {
  const docRef = await addDoc(collection(db, "rentPayments"), payment);
  return docRef.id;
};

export const getRentPaymentsByUser = async (userId: string): Promise<RentPayment[]> => {
  const q = query(collection(db, "rentPayments"), where("userId", "==", userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RentPayment));
};

// Reminders
export const getPendingReminders = async (propertyId: string): Promise<Reminder[]> => {
  const q = query(collection(db, "reminders"), where("propertyId", "==", propertyId), where("status", "==", "PENDING"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder));
};
