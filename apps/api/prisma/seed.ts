import "dotenv/config";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, PropertyType, RoomType } from "@prisma/client";

dotenv.config({ path: "../../.env", quiet: true });
dotenv.config({ quiet: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  const existingUser = await prisma.user.findUnique({
    where: { phone: "9999999999" },
  });

  if (existingUser) {
    return;
  }

  const user = await prisma.user.create({
    data: {
      phone: "9999999999",
      role: "OWNER",
      ownerProfile: {
        create: {
          displayName: "Demo Owner",
          companyName: "TenantEase Demo",
          subscription: {
            create: {
              plan: "FREE",
              maxProperties: 1,
              maxStaffAccounts: 0,
              smsEnabled: false,
              whatsappEnabled: false,
              emailEnabled: true,
              onlinePaymentsEnabled: false,
            },
          },
        },
      },
    },
    include: {
      ownerProfile: true,
    },
  });

  if (!user.ownerProfile) {
    return;
  }

  const property = await prisma.property.create({
    data: {
      ownerProfileId: user.ownerProfile.id,
      name: "Demo Residency",
      address: "12 MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      pinCode: "560001",
      type: PropertyType.PG,
      settings: {
        create: {
          rentDueDay: 5,
          lateFeePerDay: 5000,
          lateFeeGraceDays: 3,
          contactPhone: "9999999999",
        },
      },
      reminderConfig: {
        create: {
          preDueDays: 3,
          onDueEnabled: true,
          overdueFrequency: "DAILY",
          inAppEnabled: true,
          smsEnabled: true,
        },
      },
    },
  });

  await prisma.room.createMany({
    data: [
      {
        propertyId: property.id,
        roomNumber: "101",
        type: RoomType.DOUBLE,
        bedCount: 2,
        occupiedBeds: 0,
        monthlyRent: 800000,
        depositAmount: 1200000,
      },
      {
        propertyId: property.id,
        roomNumber: "102",
        type: RoomType.TRIPLE,
        bedCount: 3,
        occupiedBeds: 0,
        monthlyRent: 650000,
        depositAmount: 1000000,
      },
    ],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
