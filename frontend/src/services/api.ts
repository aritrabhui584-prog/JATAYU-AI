/**
 * JATAYU AI - API Service Configuration
 * Centralized API endpoints targeting relative same-origin or configured base URL.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
export const API_BASE = `${API_BASE_URL}/api`;

export * from '../api/client';
