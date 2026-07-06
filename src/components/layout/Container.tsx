export default function Container({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "0 20px",
        width: "100%",
      }}
    >
      {children}
    </div>
  );
}
