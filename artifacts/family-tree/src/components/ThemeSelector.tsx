import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateFamily, useGetFamily, getGetFamilyQueryKey } from "@workspace/api-client-react";

export function ThemeSelector() {
  const { familyId } = useAuth();
  const { data: family } = useGetFamily(familyId ?? "", {
    query: { enabled: !!familyId, queryKey: getGetFamilyQueryKey(familyId ?? "") }
  });
  const updateFamily = useUpdateFamily();

  const [localTheme, setLocalTheme] = useState("heritage");

  useEffect(() => {
    const saved = localStorage.getItem("family-theme");
    if (saved) {
      setLocalTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } else if (family?.theme) {
      setLocalTheme(family.theme);
      document.documentElement.setAttribute("data-theme", family.theme);
    } else {
      document.documentElement.setAttribute("data-theme", "heritage");
    }
  }, [family?.theme]);

  const handleThemeChange = (theme: string) => {
    setLocalTheme(theme);
    localStorage.setItem("family-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);

    if (familyId) {
      updateFamily.mutate({ familyId, data: { theme: theme as "heritage" | "vibrant" | "cyber" } });
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm" data-testid="theme-selector">
      <span className="text-muted-foreground">Theme</span>
      <Select value={localTheme} onValueChange={handleThemeChange}>
        <SelectTrigger className="w-[140px] h-8 bg-transparent border-white/20">
          <SelectValue placeholder="Select theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="heritage">Heritage</SelectItem>
          <SelectItem value="vibrant">Vibrant</SelectItem>
          <SelectItem value="cyber">Cyber</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
