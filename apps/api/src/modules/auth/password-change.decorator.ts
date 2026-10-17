import { SetMetadata } from "@nestjs/common";

export const ALLOWED_BEFORE_PASSWORD_CHANGE = "didban:allowedBeforePasswordChange";

/**
 * ADR 0024: a session whose user still has a temporary password reaches only the routes marked
 * with this (me, logout, change password). Every other route answers 403 PASSWORD_CHANGE_REQUIRED.
 */
export const AllowedBeforePasswordChange = () => SetMetadata(ALLOWED_BEFORE_PASSWORD_CHANGE, true);
