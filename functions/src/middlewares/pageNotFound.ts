import { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/httpError";

export default function pageNotFound(req: Request, res: Response, next: NextFunction) {
  next(HttpError.NotFound());
}
