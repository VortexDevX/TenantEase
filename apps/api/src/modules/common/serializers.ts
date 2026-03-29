import type {
  MaintenanceCommentDto,
  MaintenanceRequestDto,
  PaymentDto,
  PropertyDto,
  ReceiptDto,
  RentEntryDto,
  RoomDto,
  TenantDto
} from "@tenantease/types";
import type {
  PaymentMode,
  MaintenanceCategory,
  MaintenanceStatus,
  MaintenanceUrgency,
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
}): ReceiptDto {
  return {
    id: input.id,
    paymentId: input.paymentId,
    receiptNumber: input.receiptNumber,
    fileUrl: `/receipts/${input.id}/download`,
    generatedAt: input.generatedAt.toISOString()
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
