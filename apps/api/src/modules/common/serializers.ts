import type {
  MaintenanceCommentDto,
  MaintenanceRequestDto,
  NotificationDto,
  PaymentDto,
  PropertySettingsDto,
  PropertyDto,
  ReceiptDto,
  ReminderConfigDto,
  ReminderLogDto,
  RentEntryDto,
  RoomTransferRecordDto,
  RoomDto,
  TenantDto,
  VacateRecordDto
} from "@tenantease/types";
import type {
  PaymentMode,
  MaintenanceCategory,
  MaintenanceStatus,
  MaintenanceUrgency,
  Notification,
  PropertyType,
  RentStatus,
  RoomStatus,
  RoomType,
  TenantStatus
} from "@prisma/client";

export function toPropertyDto(input: {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  type: PropertyType;
  createdAt: Date;
  rooms: { bedCount: number; occupiedBeds: number }[];
}): PropertyDto {
  const totalRooms = input.rooms.length;
  const occupiedBeds = input.rooms.reduce((sum, room) => sum + room.occupiedBeds, 0);
  const totalBeds = input.rooms.reduce((sum, room) => sum + room.bedCount, 0);

  return {
    id: input.id,
    name: input.name,
    address: input.address,
    city: input.city,
    state: input.state,
    pinCode: input.pinCode,
    type: input.type,
    totalRooms,
    occupiedBeds,
    vacantBeds: totalBeds - occupiedBeds,
    createdAt: input.createdAt.toISOString()
  };
}

export function toRoomDto(input: {
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
}): RoomDto {
  return { ...input };
}

export function toTenantDto(input: {
  id: string;
  propertyId: string;
  roomId: string;
  fullName: string;
  phone: string;
  email: string | null;
  status: TenantStatus;
  moveInDate: Date;
  monthlyRent: number;
  depositPaid: number;
}): TenantDto {
  return {
    ...input,
    moveInDate: input.moveInDate.toISOString()
  };
}

export function toRentEntryDto(input: {
  id: string;
  tenantId: string;
  billingMonth: string;
  amountDue: number;
  amountPaid: number;
  status: RentStatus;
  dueDate: Date;
}): RentEntryDto {
  return {
    ...input,
    dueDate: input.dueDate.toISOString()
  };
}

export function toPaymentDto(input: {
  id: string;
  rentEntryId: string;
  amount: number;
  mode: PaymentMode;
  paidAt: Date;
  referenceNumber: string | null;
  note: string | null;
  isVoided: boolean;
}): PaymentDto {
  return {
    ...input,
    paidAt: input.paidAt.toISOString()
  };
}

export function toReceiptDto(input: {
  id: string;
  paymentId: string;
  receiptNumber: string;
  generatedAt: Date;
  isVoided?: boolean;
}): ReceiptDto {
  return {
    id: input.id,
    paymentId: input.paymentId,
    receiptNumber: input.receiptNumber,
    fileUrl: `/receipts/${input.id}/download`,
    generatedAt: input.generatedAt.toISOString(),
    isVoided: input.isVoided
  };
}

export function toPropertySettingsDto(input: {
  propertyId: string;
  rentDueDay: number;
  lateFeePerDay: number;
  lateFeeGraceDays: number;
  ownerPan: string | null;
  contactPhone: string | null;
}): PropertySettingsDto {
  return { ...input };
}

export function toReminderConfigDto(input: {
  propertyId: string;
  preDueDays: number;
  onDueEnabled: boolean;
  overdueFrequency: string;
  inAppEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  friendlyTemplate: string;
  overdueTemplate: string;
}): ReminderConfigDto {
  return {
    ...input,
    overdueFrequency: input.overdueFrequency === "WEEKLY" ? "WEEKLY" : "DAILY"
  };
}

export function toReminderLogDto(input: {
  id: string;
  propertyId: string;
  tenantId: string;
  rentEntryId: string | null;
  channel: string;
  status: string;
  message: string;
  error: string | null;
  sentAt: Date;
  tenant: { fullName: string };
}): ReminderLogDto {
  return {
    id: input.id,
    propertyId: input.propertyId,
    tenantId: input.tenantId,
    rentEntryId: input.rentEntryId,
    tenantName: input.tenant.fullName,
    channel: input.channel,
    status: input.status,
    message: input.message,
    error: input.error,
    sentAt: input.sentAt.toISOString()
  };
}

export function toNotificationDto(input: Pick<Notification, "id" | "title" | "content" | "category" | "readAt" | "createdAt">): NotificationDto {
  return {
    id: input.id,
    title: input.title,
    content: input.content,
    category: input.category,
    readAt: input.readAt?.toISOString() ?? null,
    createdAt: input.createdAt.toISOString()
  };
}

export function toRoomTransferRecordDto(input: {
  id: string;
  tenantId: string;
  propertyId: string;
  fromRoomId: string;
  toRoomId: string;
  effectiveDate: Date;
  monthlyRentBefore: number;
  monthlyRentAfter: number | null;
  note: string | null;
  createdAt: Date;
}): RoomTransferRecordDto {
  return {
    ...input,
    effectiveDate: input.effectiveDate.toISOString(),
    createdAt: input.createdAt.toISOString()
  };
}

export function toVacateRecordDto(input: {
  id: string;
  tenantId: string;
  propertyId: string;
  roomId: string;
  vacatedAt: Date;
  depositPaid: number;
  damageDeduction: number;
  pendingRent: number;
  refundAmount: number;
  refundStatus: string;
  finalNotes: string | null;
  createdAt: Date;
}): VacateRecordDto {
  return {
    ...input,
    vacatedAt: input.vacatedAt.toISOString(),
    createdAt: input.createdAt.toISOString()
  };
}

export function toMaintenanceRequestDto(input: {
  id: string;
  requestNumber: string;
  propertyId: string;
  tenantId: string;
  category: MaintenanceCategory;
  description: string;
  urgency: MaintenanceUrgency;
  status: MaintenanceStatus;
  assignedWorkerName: string | null;
  assignedWorkerPhone: string | null;
  preferredTime: string | null;
  resolutionNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  tenant: {
    fullName: string;
    room: { roomNumber: string };
  };
}): MaintenanceRequestDto {
  return {
    id: input.id,
    requestNumber: input.requestNumber,
    propertyId: input.propertyId,
    tenantId: input.tenantId,
    tenantName: input.tenant.fullName,
    roomNumber: input.tenant.room.roomNumber,
    category: input.category,
    description: input.description,
    urgency: input.urgency,
    status: input.status,
    assignedWorkerName: input.assignedWorkerName,
    assignedWorkerPhone: input.assignedWorkerPhone,
    preferredTime: input.preferredTime,
    resolutionNotes: input.resolutionNotes,
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString()
  };
}

export function toMaintenanceCommentDto(input: {
  id: string;
  requestId: string;
  content: string;
  isInternal: boolean;
  createdAt: Date;
}): MaintenanceCommentDto {
  return {
    id: input.id,
    requestId: input.requestId,
    content: input.content,
    isInternal: input.isInternal,
    createdAt: input.createdAt.toISOString()
  };
}
