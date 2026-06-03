import { SignupForm } from "@/app/signup/signup-form";

export default function SignupPage({
  searchParams
}: {
  searchParams?: { invite_token?: string };
}) {
  const inviteToken = searchParams?.invite_token ?? "";

  return <SignupForm inviteToken={inviteToken} />;
}
