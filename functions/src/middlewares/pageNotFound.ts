import { Request, Response, NextFunction } from "express";

export default function pageNotFound(req: Request, res: Response, next: NextFunction) {
  const error = { status: 404, message: "Page Not Found" };
  next(error);
}
