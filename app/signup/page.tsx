import { SignupForm } from "@/app/signup/signup-form";

export default async function SignupPage({
  searchParams
}: {
  searchParams?: Promise<{ invite_token?: string }>;
}) {
  const resolvedParams = (await searchParams) ?? {};
  return <SignupForm inviteToken={resolvedParams.invite_token ?? ""} />;
}
