import AuthBootstrap from "@/components/AuthBootstrap";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthBootstrap>
      {children}
    </AuthBootstrap>
  );
}