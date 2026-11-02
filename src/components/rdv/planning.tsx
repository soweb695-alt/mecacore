"use client";

import { format, getDay, parse, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { dateFnsLocalizer, type CalendarProps, type EventProps, type Formats, type Messages } from "react-big-calendar";
import { toast } from "sonner";
import { RdvForm, type RdvInitial } from "@/components/rdv/rdv-form";
import ShadcnBigCalendar from "@/components/shadcn-big-calendar/shadcn-big-calendar";
import { LABELS, StatusBadge, TONE_RDV } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/client-api";
import "./planning.css";

export type VuePlanning = "month" | "week" | "day";

export interface PlanningEvent {
  id: string;
  /** "YYYY-MM-DDTHH:mm", heure de Paris */
  debut: string;
  fin: string;
  userId: string;
  collaborateur: string;
  clientId: string;
  clientNom: string;
  vehiculeId: string;
  vehicule: string;
  motif: string | null;
  devisId: string | null;
  devisNumero: string | null;
  statut: "PLANIFIE" | "CONFIRME" | "HONORE" | "ANNULE" | "NO_SHOW";
}

interface CalEvent {
  title: string;
  start: Date;
  end: Date;
  rdv: PlanningEvent;
}

interface Props {
  vue: VuePlanning;
  jour: string;
  events: PlanningEvent[];
  /** userId → couleur #rrggbb */
  couleurs: Record<string, string>;
  collaborateurs: { id: string; nom: string; couleur: string }[];
  peutModifier: boolean;
}

const localizer = dateFnsLocalizer({ format, parse, startOfWeek: (d: Date) => startOfWeek(d, { weekStartsOn: 1 }), getDay, locales: { fr } });

const MESSAGES: Messages<CalEvent> = {
  date: "Date", time: "Heure", event: "Rendez-vous", allDay: "Journée", week: "Semaine", work_week: "Semaine ouvrée", day: "Jour", month: "Mois",
  previous: "Précédent", next: "Suivant", yesterday: "Hier", tomorrow: "Demain", today: "Aujourd'hui", agenda: "Agenda",
  noEventsInRange: "Aucun rendez-vous sur cette période.", showMore: (n) => `+${n} autre${n > 1 ? "s" : ""}`,
};

const FORMATS: Formats = {
  timeGutterFormat: "HH:mm",
  dayFormat: "EEE dd/MM",
  weekdayFormat: "EEE",
  dayHeaderFormat: "EEEE d MMMM yyyy",
  dayRangeHeaderFormat: ({ start, end }, culture, loc) => `${loc!.format(start, "d MMM", culture)} – ${loc!.format(end, "d MMM yyyy", culture)}`,
  eventTimeRangeFormat: ({ start, end }, culture, loc) => `${loc!.format(start, "HH:mm", culture)} – ${loc!.format(end, "HH:mm", culture)}`,
};

// Les heures de Paris sont posées telles quelles sur des dates locales : le planning affiche l'heure du garage quel que soit le fuseau du poste.
const versDate = (s: string) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)), Number(s.slice(11, 13) || 0), Number(s.slice(14, 16) || 0));
const MIN = new Date(1970, 0, 1, 7, 0);
const MAX = new Date(1970, 0, 1, 20, 0);
// Les identifiants (cuid) sont déjà sûrs ; le filtre garantit un nom de classe valide quoi qu'il arrive.
const classeCollab = (userId: string) => `rdv-collab-${userId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

function Evenement({ event }: EventProps<CalEvent>) {
  return (
    <span className="block overflow-hidden text-[11px] leading-tight">
      <b>{event.rdv.debut.slice(11, 16)}</b> {event.rdv.clientNom}
      <span className="block truncate opacity-75">{event.rdv.vehicule}</span>
    </span>
  );
}

export function Planning({ vue, jour, events, couleurs, collaborateurs, peutModifier }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<RdvInitial | null>(null);
  const [detail, setDetail] = useState<PlanningEvent | null>(null);

  const calEvents = useMemo<CalEvent[]>(() => events.map((e) => ({ title: `${e.clientNom} · ${e.vehicule}`, start: versDate(e.debut), end: versDate(e.fin), rdv: e })), [events]);

  // Une règle par collaborateur : fond teinté de sa couleur, liseré plein, texte du thème.
  const styles = useMemo(
    () =>
      Object.entries(couleurs)
        .map(([id, c]) => `.rbc-event.${classeCollab(id)},.rbc-event.${classeCollab(id)}:hover{--event-bg:color-mix(in oklab,${c} 16%,var(--card));--event-border:${c};--event-color:var(--foreground)}`)
        .join("\n"),
    [couleurs],
  );

  const eventPropGetter: CalendarProps<CalEvent>["eventPropGetter"] = (event) => ({
    className: [classeCollab(event.rdv.userId), (event.rdv.statut === "ANNULE" || event.rdv.statut === "NO_SHOW") && "rdv-inactif"].filter(Boolean).join(" "),
  });

  function aller(v: VuePlanning, d: Date) {
    router.push(`/rendez-vous?vue=${v}&date=${format(d, "yyyy-MM-dd")}`);
  }

  async function statut(id: string, s: PlanningEvent["statut"]) {
    try {
      await api(`/api/rendez-vous/${id}`, "PATCH", { statut: s });
      toast.success("Statut mis à jour");
      setDetail(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  return (
    <div>
      <style>{styles}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-3 text-sm" aria-label="Collaborateurs">
          {collaborateurs.map((c) => (
            <li key={c.id} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px]" style={{ background: c.couleur }} aria-hidden />
              {c.nom}
            </li>
          ))}
        </ul>
        {peutModifier && (
          <Button onClick={() => setForm({ jour, debut: "09:00", fin: "10:00" })}>
            <Plus aria-hidden />
            Nouveau RDV
          </Button>
        )}
      </div>

      <div className="planning-calendrier overflow-x-auto rounded-xl border bg-card">
        <ShadcnBigCalendar<CalEvent>
          localizer={localizer}
          culture="fr"
          messages={MESSAGES}
          formats={FORMATS}
          events={calEvents}
          views={["month", "week", "day"]}
          view={vue}
          date={versDate(jour)}
          onView={(v) => aller(v as VuePlanning, versDate(jour))}
          onNavigate={(d, v) => aller(v as VuePlanning, d)}
          min={MIN}
          max={MAX}
          step={15}
          timeslots={4}
          scrollToTime={new Date(1970, 0, 1, 8, 0)}
          eventPropGetter={eventPropGetter}
          components={{ event: Evenement }}
          tooltipAccessor={(e) => `${e.rdv.debut.slice(11, 16)}–${e.rdv.fin.slice(11, 16)} · ${e.rdv.clientNom} · ${e.rdv.vehicule} · ${e.rdv.collaborateur}`}
          onSelectEvent={(e) => setDetail(e.rdv)}
          onKeyPressEvent={(e, k) => "key" in k && (k.key === "Enter" || k.key === " ") && setDetail(e.rdv)}
          selectable={peutModifier}
          onSelectSlot={({ start, end }) => {
            // En vue mois, le créneau est une journée entière : on propose 9 h – 10 h.
            const horaire = start.getHours() !== 0 || end.getHours() !== 0;
            setForm({ jour: format(start, "yyyy-MM-dd"), debut: horaire ? format(start, "HH:mm") : "09:00", fin: horaire ? format(end, "HH:mm") : "10:00" });
          }}
          style={{ height: 720, minWidth: 760 }}
        />
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.clientNom}</DialogTitle>
                <DialogDescription>
                  {detail.vehicule} · {detail.debut.slice(11, 16)} – {detail.fin.slice(11, 16)} · {detail.collaborateur}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <StatusBadge tone={TONE_RDV[detail.statut]}>{LABELS.statutRdv[detail.statut]}</StatusBadge>
                {detail.motif && <p>Motif : {detail.motif}</p>}
                {peutModifier && detail.devisId && (
                  <Link href={`/devis/${detail.devisId}`} className="block text-link hover:underline">
                    Devis {detail.devisNumero}
                  </Link>
                )}
                {peutModifier && (
                  <Link href={`/clients/${detail.clientId}`} className="text-link hover:underline">
                    Ouvrir la fiche client
                  </Link>
                )}
              </div>
              {peutModifier && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => statut(detail.id, "CONFIRME")}>
                    Confirmer
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => statut(detail.id, "HONORE")}>
                    Honoré
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => statut(detail.id, "NO_SHOW")}>
                    Absent
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { const d = detail; setDetail(null); setForm({ id: d.id, clientId: d.clientId, clientNom: d.clientNom, vehiculeId: d.vehiculeId, userId: d.userId, jour: d.debut.slice(0, 10), debut: d.debut.slice(11, 16), fin: d.fin.slice(11, 16), motif: d.motif ?? "", devisId: d.devisId, devisNumero: d.devisNumero }); }}>
                    Déplacer
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => statut(detail.id, "ANNULE")}>
                    Annuler le rendez-vous
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Déplacer le rendez-vous" : "Nouveau rendez-vous"}</DialogTitle>
            <DialogDescription>Un collaborateur ne peut pas avoir deux rendez-vous en même temps.</DialogDescription>
          </DialogHeader>
          {form && <RdvForm key={form.id ?? "nouveau"} initial={form} collaborateurs={collaborateurs} onDone={() => setForm(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
