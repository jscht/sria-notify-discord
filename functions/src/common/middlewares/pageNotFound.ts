/**
 * Page Not Found Middleware
 * 404 에러 처리
 */

import type { Request, Response, NextFunction } from "express";
import { HttpError } from "@/common/utils";

export default function pageNotFound(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  next(HttpError.NotFound());
}
