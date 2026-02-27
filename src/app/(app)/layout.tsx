import AuthBootstrap from "@/components/AuthBootstrap";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthBootstrap requireAuth>{children}</AuthBootstrap>;
}