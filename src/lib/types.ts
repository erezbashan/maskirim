export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Property {
  id?: string;
  userId: string; // The user who manages this
  ownerName: string; // The actual owner (e.g., "Myself", "My Son")
  address: string;
  city: string;
  notes?: string;
  createdAt: string;
}

export interface Tenant {
  id?: string;
  propertyId: string;
  name: string;
  phone?: string;
  email?: string;
  paymentDueDay?: number | null;
  createdAt: string;
}

export interface RentPeriod {
  id?: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  renewalDeadline?: string; // e.g. date by which renewal must be agreed
  renewalTerms?: string;
  guaranteeType?: string;
  documentUrl?: string; // Link to extension/lease agreement PDF
  createdAt: string;
}

export interface Expense {
  id?: string;
  propertyId: string;
  amount: number;
  date: string;
  category: string; // e.g., "Maintenance", "Taxes", "Insurance"
  description?: string;
  receiptUrl?: string; // Link to uploaded receipt
  createdAt: string;
}

export interface Document {
  id?: string;
  userId: string;
  propertyId?: string;
  tenantId?: string;
  rentPeriodId?: string;
  name: string;
  url: string;
  type: 'LEASE' | 'EXTENSION' | 'EXPENSE' | 'ID_CARD' | 'OTHER' | 'TERMINATION';
  createdAt: string;
}

export interface RentPayment {
  id?: string;
  userId: string;
  propertyId: string;
  tenantId: string;
  rentPeriodId: string;
  expectedDate: string; // YYYY-MM-DD
  paidDate: string;     // ISO string
  amount: number;
  status: 'PAID';
}

export interface Reminder {
  id?: string;
  propertyId: string;
  type: 'RENT_DUE' | 'LEASE_EXPIRATION' | 'CUSTOM' | 'LEGAL';
  title: string;
  dueDate: string;
  status: 'PENDING' | 'COMPLETED';
  createdAt: string;
}
