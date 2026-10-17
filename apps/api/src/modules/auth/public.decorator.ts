import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC = "didban:public";

/** No session needed. Only for the spec §11 allowlist: health, login, accept-invite, share, ingest. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
