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

export type UserRole = "ADMIN" | "OWNER" | "TENANT";

export type PropertyType = "PG" | "HOSTEL" | "FLAT" | "HOUSE";
export type RoomType = "SINGLE" | "DOUBLE" | "TRIPLE" | "DORMITORY";
export type RoomStatus = "VACANT" | "PARTIAL" | "OCCUPIED";
export type TenantStatus = "ACTIVE" | "NOTICE" | "VACATED";
export type RentStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";
export type PaymentMode = "CASH" | "UPI" | "BANK_TRANSFER" | "ONLINE";
export type MaintenanceCategory = "PLUMBING" | "ELECTRICAL" | "FURNITURE" | "INTERNET" | "CLEANING" | "OTHER";
export type MaintenanceUrgency = "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY";
export type MaintenanceStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type UtilityType = "ELECTRICITY" | "WATER" | "GAS" | "INTERNET";
export type BillingModel = "FLAT_RATE" | "PER_TENANT" | "INDIVIDUAL_METER" | "SHARED_METER";

export type AuthUser = {
  id: string;
  phone: string;
  role: UserRole;
  ownerProfileId?: string | null;
  tenantId?: string | null;
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
  floor: number | null;
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

export type UtilityReadingDto = {
  id: string;
  propertyId: string;
  roomId: string | null;
  utilityType: UtilityType;
  month: number;
  year: number;
  previousReading: number | null;
  currentReading: number | null;
  unitsConsumed: number | null;
  ratePerUnit: number | null;
  totalCharge: number;
  billingModel: BillingModel;
  notes: string | null;
  createdAt: string;
};

export type UtilityInputDto = {
  utilityType: UtilityType;
  month: number;
  year: number;
  billingModel: BillingModel;
  ratePerUnit: number;
  readings: Array<{
    roomId: string;
    previousReading?: number;
    currentReading: number;
  }>;
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

export type TenantReceiptDto = {
  id: string;
  paymentId: string;
  receiptNumber: string;
  fileUrl: string;
  generatedAt: string;
  amount: number;
  mode: PaymentMode;
  paidAt: string;
  billingMonth: string;
};

export type AgreementDto = {
  id: string;
  tenantId: string;
  propertyId: string;
  templateType: string;
  state: string | null;
  startDate: string;
  endDate: string | null;
  duration: string | null;
  pdfUrl: string | null;
  status: string;
  createdAt: string;
};
