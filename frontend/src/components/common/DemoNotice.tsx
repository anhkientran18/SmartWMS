import { isDemoMode } from '../../app/dataMode';
import { useTranslation } from 'react-i18next';
export default function DemoNotice() {
  const { t } = useTranslation();
  if (!isDemoMode) return null;
  return <div role="note" className="fixed bottom-0 left-0 right-0 z-[100] bg-amber-100 border-t border-amber-300 text-amber-950 text-[11px] px-3 py-1 text-center">{t('f0.demoNotice')}</div>;
}
