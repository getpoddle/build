import { useUserWorkspaces } from '../hooks/useWorkspaceAccess';
import DecisionMapBoard from '../components/DecisionMap';

interface DecisionMapPageProps {
  onNavigate: (page: string, workspaceId?: string) => void;
}

export default function DecisionMapPage({ onNavigate }: DecisionMapPageProps) {
  const { workspaces, loading } = useUserWorkspaces();
  const appWorkspaces = workspaces.filter(w => w.source !== 'slack');

  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg)' }}>
      <div
        className="px-4 sm:px-6 lg:px-8 py-6 lg:py-10 mx-auto"
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mb-6 lg:mb-10">
          <p className="section-label mb-2">Decisions</p>
          <h1 className="display-heading text-2xl lg:text-3xl xl:text-4xl mb-1">
            Decision Map
          </h1>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-20" />)}
          </div>
        )}

        {!loading && appWorkspaces.length === 0 && (
          <div className="panel p-8 lg:p-16 text-center">
            <p className="text-sm" style={{ color: 'var(--app-text-secondary)' }}>
              No workspaces to map yet.
            </p>
          </div>
        )}

        {!loading && appWorkspaces.length > 0 && (
          <DecisionMapBoard workspaces={appWorkspaces} onNavigate={onNavigate} />
        )}
      </div>
    </div>
  );
}
