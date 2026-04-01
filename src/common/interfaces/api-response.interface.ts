export interface ApiResponse<T> {
  message: string;
  description?: string;
  data?: T;
  total?: number;
  meta?: { page?: number; limit?: number; totalPages?: number };
}
