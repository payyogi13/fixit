export type UserRole = 'admin' | 'technician' | 'customer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export type RepairStatus = 'pending' | 'assigned' | 'in-progress' | 'completed' | 'cancelled';

export interface RepairRequest {
  id: string;
  customerId: string;
  customerName: string;
  deviceType: string;
  issueDescription: string;
  status: RepairStatus;
  technicianId?: string;
  technicianName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepairLog {
  id: string;
  requestId: string;
  technicianId: string;
  note: string;
  timestamp: string;
}
