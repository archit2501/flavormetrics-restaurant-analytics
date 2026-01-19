import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'The Golden Fork',
      address: '123 Main Street',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
      phone: '(415) 555-0100',
      email: 'info@goldenfork.com',
      timezone: 'America/Los_Angeles',
      openingHour: 11,
      closingHour: 23,
      seatingCapacity: 120,
    },
  });

  console.log('Created restaurant:', restaurant.name);

  // Create staff
  const hashedPassword = await bcrypt.hash('password123', 12);

  const staff = await prisma.staff.createMany({
    data: [
      {
        restaurantId: restaurant.id,
        email: 'manager@goldenfork.com',
        password: hashedPassword,
        firstName: 'Sarah',
        lastName: 'Johnson',
        role: 'MANAGER',
        hourlyRate: 28.0,
      },
      {
        restaurantId: restaurant.id,
        email: 'server1@goldenfork.com',
        password: hashedPassword,
        firstName: 'Mike',
        lastName: 'Chen',
        role: 'SERVER',
        hourlyRate: 18.0,
      },
      {
        restaurantId: restaurant.id,
        email: 'server2@goldenfork.com',
        password: hashedPassword,
        firstName: 'Emily',
        lastName: 'Rodriguez',
        role: 'SERVER',
        hourlyRate: 18.0,
      },
      {
        restaurantId: restaurant.id,
        email: 'kitchen@goldenfork.com',
        password: hashedPassword,
        firstName: 'David',
        lastName: 'Kim',
        role: 'KITCHEN',
        hourlyRate: 22.0,
      },
      {
        restaurantId: restaurant.id,
        email: 'bartender@goldenfork.com',
        password: hashedPassword,
        firstName: 'Lisa',
        lastName: 'Thompson',
        role: 'BARTENDER',
        hourlyRate: 20.0,
      },
    ],
  });

  console.log(`Created ${staff.count} staff members`);

  // Create menu items
  const menuItems = await prisma.menuItem.createMany({
    data: [
      // Appetizers
      {
        restaurantId: restaurant.id,
        name: 'Crispy Calamari',
        description: 'Tender calamari rings with spicy aioli',
        category: 'Appetizers',
        price: 14.95,
        cost: 4.50,
        preparationTime: 12,
        isVegetarian: false,
      },
      {
        restaurantId: restaurant.id,
        name: 'Bruschetta',
        description: 'Toasted bread with tomatoes, basil, and balsamic',
        category: 'Appetizers',
        price: 11.95,
        cost: 3.00,
        preparationTime: 8,
        isVegetarian: true,
        isVegan: true,
      },
      {
        restaurantId: restaurant.id,
        name: 'Spinach Artichoke Dip',
        description: 'Creamy dip with tortilla chips',
        category: 'Appetizers',
        price: 12.95,
        cost: 3.50,
        preparationTime: 10,
        isVegetarian: true,
        isGlutenFree: true,
      },
      // Main Courses
      {
        restaurantId: restaurant.id,
        name: 'Grilled Salmon',
        description: 'Atlantic salmon with lemon dill sauce',
        category: 'Main Courses',
        price: 28.95,
        cost: 10.00,
        preparationTime: 20,
        isGlutenFree: true,
      },
      {
        restaurantId: restaurant.id,
        name: 'Ribeye Steak',
        description: '12oz USDA Prime ribeye with herb butter',
        category: 'Main Courses',
        price: 42.95,
        cost: 18.00,
        preparationTime: 25,
        isGlutenFree: true,
      },
      {
        restaurantId: restaurant.id,
        name: 'Chicken Parmesan',
        description: 'Breaded chicken with marinara and mozzarella',
        category: 'Main Courses',
        price: 24.95,
        cost: 7.50,
        preparationTime: 18,
      },
      {
        restaurantId: restaurant.id,
        name: 'Vegetable Risotto',
        description: 'Creamy arborio rice with seasonal vegetables',
        category: 'Main Courses',
        price: 22.95,
        cost: 6.00,
        preparationTime: 20,
        isVegetarian: true,
        isGlutenFree: true,
      },
      {
        restaurantId: restaurant.id,
        name: 'Pasta Primavera',
        description: 'Penne with fresh vegetables in garlic olive oil',
        category: 'Main Courses',
        price: 19.95,
        cost: 5.00,
        preparationTime: 15,
        isVegan: true,
        isVegetarian: true,
      },
      // Desserts
      {
        restaurantId: restaurant.id,
        name: 'Tiramisu',
        description: 'Classic Italian coffee-flavored dessert',
        category: 'Desserts',
        price: 9.95,
        cost: 2.50,
        preparationTime: 5,
        isVegetarian: true,
      },
      {
        restaurantId: restaurant.id,
        name: 'Chocolate Lava Cake',
        description: 'Warm chocolate cake with molten center',
        category: 'Desserts',
        price: 11.95,
        cost: 3.00,
        preparationTime: 15,
        isVegetarian: true,
      },
      // Beverages
      {
        restaurantId: restaurant.id,
        name: 'House Red Wine',
        description: 'California Cabernet Sauvignon',
        category: 'Beverages',
        price: 10.00,
        cost: 3.00,
        preparationTime: 2,
        isVegan: true,
        isVegetarian: true,
        isGlutenFree: true,
      },
      {
        restaurantId: restaurant.id,
        name: 'Craft Beer',
        description: 'Local IPA on draft',
        category: 'Beverages',
        price: 8.00,
        cost: 2.50,
        preparationTime: 2,
        isVegan: true,
        isVegetarian: true,
      },
    ],
  });

  console.log(`Created ${menuItems.count} menu items`);

  // Create inventory items
  const inventoryItems = await prisma.inventoryItem.createMany({
    data: [
      {
        restaurantId: restaurant.id,
        name: 'Atlantic Salmon',
        category: 'Seafood',
        unit: 'lbs',
        currentQuantity: 25,
        reorderPoint: 10,
        parLevel: 40,
        unitCost: 12.00,
        vendor: 'Pacific Seafood Co.',
        expirationDays: 3,
        storageLocation: 'Walk-in Cooler',
      },
      {
        restaurantId: restaurant.id,
        name: 'Ribeye Steak',
        category: 'Meat',
        unit: 'lbs',
        currentQuantity: 30,
        reorderPoint: 15,
        parLevel: 50,
        unitCost: 18.00,
        vendor: 'Prime Meats Inc.',
        expirationDays: 5,
        storageLocation: 'Walk-in Cooler',
      },
      {
        restaurantId: restaurant.id,
        name: 'Chicken Breast',
        category: 'Poultry',
        unit: 'lbs',
        currentQuantity: 20,
        reorderPoint: 12,
        parLevel: 35,
        unitCost: 5.50,
        vendor: 'Farm Fresh Poultry',
        expirationDays: 4,
        storageLocation: 'Walk-in Cooler',
      },
      {
        restaurantId: restaurant.id,
        name: 'Arborio Rice',
        category: 'Dry Goods',
        unit: 'lbs',
        currentQuantity: 15,
        reorderPoint: 5,
        parLevel: 25,
        unitCost: 3.00,
        vendor: 'Italian Imports',
        storageLocation: 'Dry Storage',
      },
      {
        restaurantId: restaurant.id,
        name: 'Olive Oil',
        category: 'Oils',
        unit: 'liters',
        currentQuantity: 8,
        reorderPoint: 3,
        parLevel: 12,
        unitCost: 15.00,
        vendor: 'Mediterranean Foods',
        storageLocation: 'Dry Storage',
      },
      {
        restaurantId: restaurant.id,
        name: 'Mozzarella Cheese',
        category: 'Dairy',
        unit: 'lbs',
        currentQuantity: 10,
        reorderPoint: 5,
        parLevel: 20,
        unitCost: 8.00,
        vendor: 'Dairy Direct',
        expirationDays: 14,
        storageLocation: 'Walk-in Cooler',
      },
      {
        restaurantId: restaurant.id,
        name: 'Fresh Tomatoes',
        category: 'Produce',
        unit: 'lbs',
        currentQuantity: 12,
        reorderPoint: 8,
        parLevel: 25,
        unitCost: 2.50,
        vendor: 'Local Farms',
        expirationDays: 5,
        storageLocation: 'Walk-in Cooler',
      },
      {
        restaurantId: restaurant.id,
        name: 'House Red Wine',
        category: 'Beverages',
        unit: 'bottles',
        currentQuantity: 24,
        reorderPoint: 12,
        parLevel: 48,
        unitCost: 10.00,
        vendor: 'Wine Distributors',
        storageLocation: 'Wine Cellar',
      },
    ],
  });

  console.log(`Created ${inventoryItems.count} inventory items`);

  // Create customers
  const customers = await prisma.customer.createMany({
    data: [
      {
        restaurantId: restaurant.id,
        email: 'john.doe@email.com',
        phone: '415-555-0101',
        firstName: 'John',
        lastName: 'Doe',
        loyaltyPoints: 250,
        totalSpent: 485.50,
        visitCount: 12,
        segment: 'REGULAR',
      },
      {
        restaurantId: restaurant.id,
        email: 'jane.smith@email.com',
        phone: '415-555-0102',
        firstName: 'Jane',
        lastName: 'Smith',
        loyaltyPoints: 850,
        totalSpent: 1250.00,
        visitCount: 28,
        segment: 'VIP',
      },
      {
        restaurantId: restaurant.id,
        email: 'bob.wilson@email.com',
        phone: '415-555-0103',
        firstName: 'Bob',
        lastName: 'Wilson',
        loyaltyPoints: 1500,
        totalSpent: 2850.00,
        visitCount: 52,
        segment: 'CHAMPION',
      },
      {
        restaurantId: restaurant.id,
        email: 'alice.johnson@email.com',
        phone: '415-555-0104',
        firstName: 'Alice',
        lastName: 'Johnson',
        loyaltyPoints: 50,
        totalSpent: 125.00,
        visitCount: 3,
        segment: 'NEW',
      },
      {
        restaurantId: restaurant.id,
        email: 'charlie.brown@email.com',
        phone: '415-555-0105',
        firstName: 'Charlie',
        lastName: 'Brown',
        loyaltyPoints: 100,
        totalSpent: 320.00,
        visitCount: 8,
        segment: 'AT_RISK',
      },
    ],
  });

  console.log(`Created ${customers.count} customers`);

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
