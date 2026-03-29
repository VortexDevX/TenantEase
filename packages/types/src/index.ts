export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID_TOKEN"
  | "AUTH_TOKEN_EXPIRED"
  | "AUTH_INVALID_OTP"
  | "AUTH_OTP_EXPIRED"
  | "AUTH_FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "PROPERTY_NOT_FOUND"
  | "ROOM_NOT_FOUND"
  | "TENANT_NOT_FOUND"
  | "RENT_ENTRY_NOT_FOUND"
  | "PAYMENT_NOT_FOUND"
  | "RECEIPT_NOT_FOUND"
  | "REQUEST_NOT_FOUND"
  | "INVALID_MAINTENANCE_TRANSITION"
  | "ROOM_NO_VACANCY"
  | "ROOM_HAS_TENANTS"
  | "TENANT_ALREADY_VACATED"
  | "INVALID_TRANSFER"
  | "PAYMENT_TOO_OLD"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: PaginationMeta;
};

export type ApiFailure = {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type UserRole = "OWNER";

export type PropertyType = "PG" | "HOSTEL" | "FLAT" | "HOUSE";
export type RoomType = "SINGLE" | "DOUBLE" | "TRIPLE" | "DORMITORY";
export type RoomStatus = "VACANT" | "PARTIAL" | "OCCUPIED";
export type TenantStatus = "ACTIVE" | "NOTICE" | "VACATED";
export type RentStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";
export type PaymentMode = "CASH" | "UPI" | "BANK_TRANSFER";
export type MaintenanceCategory = "PLUMBING" | "ELECTRICAL" | "FURNITURE" | "INTERNET" | "CLEANING" | "OTHER";
export type MaintenanceUrgency = "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY";
export type MaintenanceStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type AuthUser = {
  id: string;
  phone: string;
  role: UserRole;
  ownerProfileId: string;
};

export type PropertyDto = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  type: PropertyType;
  totalRooms: number;
  occupiedBeds: number;
  vacantBeds: number;
  createdAt: string;
};

export type RoomDto = {
  id: string;
  propertyId: string;
  roomNumber: string;
  type: RoomType;
  bedCount: number;
  occupiedBeds: number;
  monthlyRent: number;
  depositAmount: number;
  status: RoomStatus;
};

export type TenantDto = {
  id: string;
  propertyId: string;
  roomId: string;
  fullName: string;
  phone: string;
  email: string | null;
  status: TenantStatus;
  moveInDate: string;
  monthlyRent: number;
  depositPaid: number;
};

export type RentEntryDto = {
  id: string;
  tenantId: string;
  billingMonth: string;
  amountDue: number;
  amountPaid: number;
  status: RentStatus;
  dueDate: string;
};

export type PaymentDto = {
  id: string;
  rentEntryId: string;
  amount: number;
  mode: PaymentMode;
  paidAt: string;
  note: string | null;
  isVoided: boolean;
};

export type ReceiptDto = {
  id: string;
  paymentId: string;
  receiptNumber: string;
  fileUrl: string;
  generatedAt: string;
};

export type MaintenanceRequestDto = {
  id: string;
  requestNumber: string;
  propertyId: string;
  tenantId: string;
  tenantName: string;
  roomNumber: string;
  category: MaintenanceCategory;
  description: string;
  urgency: MaintenanceUrgency;
  status: MaintenanceStatus;
  assignedWorkerName: string | null;
  assignedWorkerPhone: string | null;
  preferredTime: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MaintenanceCommentDto = {
  id: string;
  requestId: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
};

export type MaintenanceSummaryDto = {
  new: number;
  inProgress: number;
  resolved: number;
  closed: number;
  total: number;
};

export type MaintenanceDetailDto = {
  request: MaintenanceRequestDto;
  comments: MaintenanceCommentDto[];
};

export type OtpVerifyResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  isNewUser: boolean;
};
