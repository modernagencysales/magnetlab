/** Accelerator layout. Full-screen without standard sidebar.
 *  The progress panel is rendered inside the AcceleratorPage component. */

export default function AcceleratorLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen w-full overflow-hidden bg-background">{children}</div>;
}
