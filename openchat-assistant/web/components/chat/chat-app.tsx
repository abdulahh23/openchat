"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { PanelLeftIcon, SquarePenIcon } from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";

import { AppSidebar } from "@/components/chat/app-sidebar";
import { Composer } from "@/components/chat/composer";
import { EmptyState, SuggestionGrid } from "@/components/chat/empty-state";
import { MessageList } from "@/components/chat/message-list";
import { ModelPicker } from "@/components/chat/model-picker";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChat } from "@/hooks/use-chat";
import { useModels } from "@/hooks/use-models";
import { cn } from "@/lib/utils";
import { fetchVoiceConfig, type VoiceHistoryMessage } from "@/lib/voice";

const VoiceSession = dynamic(() => import("@/components/voice/voice-session"), {
  ssr: false,
});

export function ChatApp() {
  const models = useModels();
  const chat = useChat(models.selection);
  const [sidebarOpen, setSidebarOpen] = useState(true); // desktop
  const [mobileOpen, setMobileOpen] = useState(false); // mobile sheet
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voicePrefs, setVoicePrefs] = useState({ voice: null as string | null, captions: true });
  const [voiceConfig, setVoiceConfig] = useState<{ voices: any[] } | null>(null);

  useEffect(() => {
    if (isVoiceMode && !voiceConfig) {
      fetchVoiceConfig().then(setVoiceConfig).catch((err) => toast.error(err.message));
    }
  }, [isVoiceMode, voiceConfig]);

  const empty = !chat.active || chat.active.messages.length === 0;
  const noModels = !models.loading && !models.effective;

  const newChat = useCallback(() => {
    chat.newChat();
    setMobileOpen(false);
  }, [chat]);

  const openChat = (id: string) => {
    chat.openChat(id);
    setMobileOpen(false);
  };

  const deleteChat = (id: string) => {
    const undo = chat.deleteChat(id);
    toast("Chat deleted", { action: { label: "Undo", onClick: undo } });
  };

  const clearAll = () => {
    const undo = chat.clearAll();
    toast("All chats deleted", { action: { label: "Undo", onClick: undo } });
  };

  const voiceHistory = useMemo((): VoiceHistoryMessage[] => {
    if (!chat.active) return [];
    return chat.active.messages
      .filter((m) => !m.error && !m.pending)
      .slice(-20)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
  }, [chat.active]);

  // Global shortcuts: new chat, search, stop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        newChat();
      } else if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSidebarOpen(true);
        setMobileOpen(true);
        requestAnimationFrame(() => document.getElementById("chat-search")?.focus());
      } else if (e.key === "Escape" && chat.streaming) {
        chat.stop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chat, newChat]);

  const sidebarProps = {
    conversations: chat.conversations,
    activeId: chat.activeId,
    onNewChat: newChat,
    onOpen: openChat,
    onDelete: deleteChat,
    onClearAll: clearAll,
    apiOnline: !models.error,
  };

  const composer = (
    <Composer
      onSend={chat.send}
      onStop={chat.stop}
      onVoiceClick={() => setIsVoiceMode(true)}
      streaming={chat.streaming}
      disabled={noModels}
      autoFocus
      placeholder={noModels ? "No AI model available — see the model menu" : undefined}
    />
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      {isVoiceMode && voiceConfig && (
        <div className="fixed inset-0 z-50 bg-background">
          <VoiceSession
            selection={models.selection}
            participantName="User"
            history={voiceHistory}
            voices={voiceConfig.voices}
            voice={voicePrefs.voice}
            captions={voicePrefs.captions}
            onPrefsChange={(patch) => setVoicePrefs((p) => ({ ...p, ...patch }))}
            onTranscripts={(messages) => {
              const convId = chat.activeId ?? (chat.conversations[0]?.id ?? "default");
              messages.forEach((m) => chat.upsertVoiceMessage(convId, m));
            }}
            onEnd={() => setIsVoiceMode(false)}
            onRetry={() => {}}
          />
        </div>
      )}
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r transition-[margin] duration-200 md:block md:w-72",
          !sidebarOpen && "md:-ml-72",
        )}
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
      >
        <AppSidebar {...sidebarProps} onCollapse={() => setSidebarOpen(false)} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showClose={false} className="w-72 p-0 md:hidden">
          <SheetTitle className="sr-only">Conversations</SheetTitle>
          <SheetDescription className="sr-only">Your chat history</SheetDescription>
          <AppSidebar {...sidebarProps} onCollapse={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 px-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open sidebar"
                className={cn(sidebarOpen && "md:hidden")}
                onClick={() => {
                  setSidebarOpen(true);
                  setMobileOpen(true);
                }}
              >
                <PanelLeftIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open sidebar</TooltipContent>
          </Tooltip>
          <ModelPicker models={models} />
          <div className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="New chat"
                className={cn(sidebarOpen && "md:hidden")}
                onClick={newChat}
              >
                <SquarePenIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New chat</TooltipContent>
          </Tooltip>
        </header>

        {empty ? (
          <div className="flex flex-1 flex-col justify-center overflow-y-auto px-3 pb-[8vh] sm:px-6">
            <EmptyState />
            {composer}
            <SuggestionGrid onPick={chat.send} />
          </div>
        ) : (
          <>
            <MessageList
              conversation={chat.active!}
              streaming={chat.streaming}
              onRegenerate={chat.regenerate}
              onFeedback={chat.setFeedback}
            />
            <div className="shrink-0 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-6">
              {composer}
            </div>
          </>
        )}
        <p className="shrink-0 pb-2 text-center text-xs text-muted-foreground">
          AI can make mistakes. Check important information.
        </p>
      </main>
    </div>
  );
}
