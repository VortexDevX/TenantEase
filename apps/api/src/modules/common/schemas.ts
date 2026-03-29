import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional()
});

export const propertyInputSchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().min(5).max(200),
  city: z.string().min(2).max(60),
  state: z.string().min(2).max(60),
  pinCode: z.string().regex(/^\d{6}$/),
  type: z.enum(["PG", "HOSTEL", "FLAT", "HOUSE"])
});

export const roomInputSchema = z.object({
  roomNumber: z.string().min(1).max(20),
  type: z.enum(["SINGLE", "DOUBLE", "TRIPLE", "DORMITORY"]),
  bedCount: z.number().int().min(1).max(20),
  monthlyRent: z.number().int().min(1),
  depositAmount: z.number().int().min(0)
});

export const tenantInputSchema = z.object({
  propertyId: uuidSchema,
  roomId: uuidSchema,
  fullName: z.string().min(2).max(100),
  phone: z.string().regex(/^\d{10}$/),
  email: z.string().email().optional().nullable(),
  moveInDate: z.string().date(),
  monthlyRent: z.number().int().min(1),
  depositPaid: z.number().int().min(0)
});

export const transferInputSchema = z.object({
  roomId: uuidSchema
});

export const vacateInputSchema = z.object({
  vacatedAt: z.string().date()
});

export const paymentInputSchema = z.object({
  rentEntryId: uuidSchema,
  amount: z.number().int().min(1),
  mode: z.enum(["CASH", "UPI", "BANK_TRANSFER"]),
  paidAt: z.string().datetime().or(z.string().date()),
  note: z.string().max(255).optional().nullable()
});

export const paymentUpdateSchema = z.object({
  amount: z.number().int().min(1).optional(),
  mode: z.enum(["CASH", "UPI", "BANK_TRANSFER"]).optional(),
  note: z.string().max(255).optional().nullable(),
  isVoided: z.boolean().optional()
});

export const maintenanceCreateSchema = z.object({
  tenantId: uuidSchema,
  propertyId: uuidSchema,
  category: z.enum(["PLUMBING", "ELECTRICAL", "FURNITURE", "INTERNET", "CLEANING", "OTHER"]),
  description: z.string().min(10).max(2000),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "EMERGENCY"]).default("MEDIUM"),
  preferredTime: z.string().max(30).optional().nullable()
});

export const maintenanceUpdateSchema = z.object({
  status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  assignedWorkerName: z.string().max(100).optional().nullable(),
  assignedWorkerPhone: z.string().regex(/^\d{10}$/).optional().nullable(),
  comment: z.string().min(1).max(1000).optional(),
  isInternalNote: z.boolean().optional().default(false),
  resolutionNotes: z.string().max(1000).optional().nullable()
});

export const maintenanceCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  isInternal: z.boolean().optional().default(false)
});

export const otpSendSchema = z.object({
  phone: z.string().regex(/^\d{10}$/)
});

export const otpVerifySchema = z.object({
  phone: z.string().regex(/^\d{10}$/),
  otp: z.string().regex(/^\d{6}$/),
  challengeId: uuidSchema
});

export const profileSchema = z.object({
  displayName: z.string().min(2).max(80).optional(),
  companyName: z.string().min(2).max(80).optional()
});
