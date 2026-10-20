/**
 * Single source of truth for the owner account.
 *
 * This lives in its own module (not authContext.tsx) because authContext is a
 * client component. Importing a 'use client' module from an API route makes
 * Next hand back a client reference instead of the real value, so the server
 * could not read the address. Both sides import from here instead.
 */
export const ADMIN_EMAIL = 'shivashiva66407@gmail.com';
