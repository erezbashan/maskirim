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
  rooms: number;
  sizeSqm?: number;
  notes?: string;
  createdAt: string;
}

export interface Lease {
  id?: string;
  propertyId: string;
  tenantName: string;
  tenantPhone?: string;
  tenantEmail?: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  guaranteeType?: string;
  documentUrl?: string; // Link to uploaded PDF
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

export interface Reminder {
  id?: string;
  propertyId: string;
  type: 'RENT_DUE' | 'LEASE_EXPIRATION' | 'CUSTOM' | 'LEGAL';
  title: string;
  dueDate: string;
  status: 'PENDING' | 'COMPLETED';
  createdAt: string;
}
