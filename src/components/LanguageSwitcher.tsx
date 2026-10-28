import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES, parseLang } from "@/i18n/language";
import { useLanguage } from "@/i18n/useLanguage";

export function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t.common.languageLabel} className="gap-1.5 px-2.5">
          <Globe className="h-4 w-4" />
          <span className="hidden text-xs font-semibold uppercase sm:inline">{lang}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={lang}
          onValueChange={(value) => {
            const next = parseLang(value);
            if (next) setLang(next);
          }}
        >
          {LANGUAGES.map((language) => (
            <DropdownMenuRadioItem key={language.code} value={language.code} lang={language.htmlLang}>
              {language.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
