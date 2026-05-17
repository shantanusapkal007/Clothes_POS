const SUPABASE_DIRECT_HOST = /^db\.[a-z0-9]+\.supabase\.co$/i;
const SUPABASE_POOLER_HOST = /\.pooler\.supabase\.com$/i;

function isSupabaseDirectUrl(url: URL) {
  return SUPABASE_DIRECT_HOST.test(url.hostname) && (url.port === "" || url.port === "5432");
}

function parseDatabaseUrl(rawUrl: string) {
  const url = new URL(rawUrl);

  if (
    (SUPABASE_DIRECT_HOST.test(url.hostname) || SUPABASE_POOLER_HOST.test(url.hostname)) &&
    url.pathname !== "/postgres"
  ) {
    url.pathname = "/postgres";
  }

  if (url.port === "6543") {
    if (!url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }

    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "5");
    }
  }

  return url;
}

export function getDatabaseConfigIssue() {
  const rawUrl = process.env.DATABASE_URL?.trim();

  if (!rawUrl) {
    return "DATABASE_URL is not set. Add the Supabase transaction pooler URL in Vercel, and keep the direct db URL in DIRECT_URL for Prisma CLI work.";
  }

  let url: URL;

  try {
    url = parseDatabaseUrl(rawUrl);
  } catch {
    return "DATABASE_URL is invalid. Copy the full Postgres connection string from Supabase Connect and save it again in Vercel.";
  }

  if (process.env.VERCEL && isSupabaseDirectUrl(url)) {
    return "Vercel is using the Supabase direct database host on port 5432, which is IPv6-only for this project. Replace DATABASE_URL with the Supabase Transaction pooler URL (host ends with .pooler.supabase.com on port 6543). Keep the direct db.ebtxozjiwjifmhsmcqzw.supabase.co:5432 URL in DIRECT_URL only.";
  }

  return null;
}

export function assertDatabaseConfig() {
  const issue = getDatabaseConfigIssue();

  if (issue) {
    throw new Error(issue);
  }
}

export function getPrismaDatasourceUrl() {
  const rawUrl = process.env.DATABASE_URL?.trim();

  if (!rawUrl) {
    throw new Error(
      "DATABASE_URL is not set. Add the Supabase transaction pooler URL in Vercel before starting the app."
    );
  }

  try {
    return parseDatabaseUrl(rawUrl).toString();
  } catch {
    throw new Error(
      "DATABASE_URL is invalid. Copy the full Postgres connection string from Supabase Connect and save it again."
    );
  }
}
