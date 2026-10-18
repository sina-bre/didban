import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import maxmind, { type CityResponse, type Reader } from "maxmind";
import { ENV } from "../../../config/config.module.js";
import type { Env } from "../../../config/env.js";

// Spec §7 step 6: in-process lookup in a local GeoLite2 (Country or City) `.mmdb`. Without
// GEOIP_DB_PATH, geo stays null (spec §23.2 "geo disabled without GeoLite2 file"). A configured
// file that cannot be opened stops startup (fail fast). Region = ISO 3166-2 ("IR-23").

export type Geo = { country: string | null; region: string | null; city: string | null };
export type GeoSource = Pick<Reader<CityResponse>, "get">;

const NO_GEO: Geo = { country: null, region: null, city: null };
const MAX_CITY_LENGTH = 100;

export function toGeo(response: CityResponse | null, storeCity: boolean): Geo {
  const country = response?.country?.iso_code ?? null;
  if (!country || !/^[A-Z]{2}$/.test(country)) return NO_GEO;
  const subdivision = response?.subdivisions?.[0]?.iso_code;
  const city = storeCity ? (response?.city?.names.en?.slice(0, MAX_CITY_LENGTH) ?? null) : null;
  return { country, region: subdivision ? `${country}-${subdivision}` : null, city };
}

@Injectable()
export class GeoLookup implements OnModuleInit {
  private source: GeoSource | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  async onModuleInit(): Promise<void> {
    if (this.env.GEOIP_DB_PATH)
      this.source = await maxmind.open<CityResponse>(this.env.GEOIP_DB_PATH);
  }

  lookup(ip: string, storeCity: boolean): Geo {
    if (!this.source) return NO_GEO;
    try {
      return toGeo(this.source.get(ip), storeCity);
    } catch {
      return NO_GEO; // not an IP the database understands
    }
  }
}
