// Public fictional profile for the Lab 08 demonstration; not an authenticated session.
export const demoUser = {
  id: "lab08-demo-user",
  name: "Demo Customer",
  email: "demo@example.test",
} as const;

export const demoUserCreateData = {
  ...demoUser,
  emailVerified: false,
  image: null,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  updatedAt: new Date("2026-10-01T00:00:00.000Z"),
};
