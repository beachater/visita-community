// Owner and admin SPA. Access is enforced by Supabase RLS, not by client-side
// route guards (PRD 5.3); guards here are only for UX.
export function App() {
  return (
    <main>
      <h1>Visita Admin</h1>
      <p>TODO: sign-in, then owner and admin areas.</p>
    </main>
  );
}
