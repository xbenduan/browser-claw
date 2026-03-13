import React from 'react';
import { useI18n } from '@/i18n';

const LanguageSwitch: React.FC = () => {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-slate-500">{t('common.language')}</span>
      <div className="flex items-center rounded-lg bg-white/70 border border-slate-200 p-0.5">
        {(['zh', 'en'] as const).map((lang) => (
          <button
            key={lang}
            className={`px-2 py-0.5 text-[10px] rounded-md transition-colors ${
              locale === lang
                ? 'bg-cyan-500 text-white'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
            onClick={() => setLocale(lang)}
          >
            {lang === 'zh' ? t('common.zh') : t('common.en')}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSwitch;
