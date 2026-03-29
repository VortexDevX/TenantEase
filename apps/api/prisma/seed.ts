import "dotenv/config";
import { PrismaClient, PropertyType, RoomType } from "@prisma/client";

const prisma = new PrismaClient();

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
      ownerProfile: {
        create: {
          displayName: "Demo Owner",
          companyName: "TenantEase Demo",
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
