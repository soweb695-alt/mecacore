export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "ERREUR",
    public details?: unknown,
  ) {
    super(message);
  }
}
