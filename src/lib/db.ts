import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase/config";
import { Property, Lease, Expense, Reminder, Document as AppDocument } from "./types";

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

export const deleteProperty = async (id: string) => {
  await deleteDoc(doc(db, "properties", id));
};

// Leases
export const addLease = async (lease: Lease) => {
  const docRef = await addDoc(collection(db, "leases"), lease);
  return docRef.id;
};

export const getLeasesByProperty = async (propertyId: string): Promise<Lease[]> => {
  const q = query(collection(db, "leases"), where("propertyId", "==", propertyId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lease));
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

// Reminders
export const getPendingReminders = async (propertyId: string): Promise<Reminder[]> => {
  const q = query(collection(db, "reminders"), where("propertyId", "==", propertyId), where("status", "==", "PENDING"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder));
};
