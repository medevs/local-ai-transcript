import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface SettingsSectionProps {
  useLLM: boolean;
  onUseLLMChange: (val: boolean) => void;
  systemPrompt: string;
  onSystemPromptChange: (val: string) => void;
  isLoadingPrompt: boolean;
}

export function SettingsSection({
  useLLM,
  onUseLLMChange,
  systemPrompt,
  onSystemPromptChange,
  isLoadingPrompt,
}: SettingsSectionProps) {
  return (
    <>
      <div className="flex items-center gap-4 px-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="use-llm"
            checked={useLLM}
            onCheckedChange={(v) => onUseLLMChange(!!v)}
          />
          <Label htmlFor="use-llm">Clean with AI</Label>
        </div>
      </div>

      {useLLM && (
        <div className="flex flex-col gap-2 px-2">
          <Label
            htmlFor="system-prompt"
            className="text-xs text-muted-foreground"
          >
            System Prompt
          </Label>
          <textarea
            id="system-prompt"
            className="h-24 w-full rounded-md border bg-background p-2 text-sm"
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(e.target.value)}
            disabled={isLoadingPrompt}
            placeholder="Enter system prompt for LLM..."
          />
        </div>
      )}
    </>
  );
}
