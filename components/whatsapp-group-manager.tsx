'use client'

import { useState } from 'react'
import { Plus, Trash2, Edit2, Check, X, Users, MessageSquare, ExternalLink, RotateCcw } from 'lucide-react'
import {
  DEFAULT_WHATSAPP_GROUPS,
  DEFAULT_WHATSAPP_TEMPLATES,
  getStoredWhatsAppGroups,
  getStoredWhatsAppTemplates,
  saveStoredWhatsAppGroups,
  saveStoredWhatsAppTemplates,
  type WhatsAppGroup,
  type WhatsAppTemplate,
} from '@/lib/whatsapp-messages'

export function WhatsAppGroupManager({
  onClose,
  onGroupsUpdated,
}: {
  onClose: () => void
  onGroupsUpdated?: (groups: WhatsAppGroup[]) => void
}) {
  const [groups, setGroups] = useState<WhatsAppGroup[]>(() => getStoredWhatsAppGroups())
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(() => getStoredWhatsAppTemplates())
  const [activeTab, setActiveTab] = useState<'groups' | 'templates'>('groups')

  // État création/édition groupe
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [groupName, setGroupName] = useState('')
  const [groupTeamFilter, setGroupTeamFilter] = useState<'E1' | 'E2' | 'both' | 'none'>('both')
  const [groupChatLink, setGroupChatLink] = useState('')

  // État création/édition template
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [templateTitle, setTemplateTitle] = useState('')
  const [templateContent, setTemplateContent] = useState('')

  const handleSaveGroup = () => {
    if (!groupName.trim()) return

    let next: WhatsAppGroup[]
    if (editingGroupId && editingGroupId !== 'new') {
      next = groups.map((g) =>
        g.id === editingGroupId
          ? { ...g, name: groupName.trim(), teamFilter: groupTeamFilter, chatLink: groupChatLink.trim() || undefined }
          : g,
      )
    } else {
      const newGroup: WhatsAppGroup = {
        id: `grp-${Date.now()}`,
        name: groupName.trim(),
        teamFilter: groupTeamFilter,
        chatLink: groupChatLink.trim() || undefined,
      }
      next = [...groups, newGroup]
    }

    setGroups(next)
    saveStoredWhatsAppGroups(next)
    onGroupsUpdated?.(next)
    setEditingGroupId(null)
    setGroupName('')
    setGroupChatLink('')
  }

  const handleDeleteGroup = (id: string) => {
    const next = groups.filter((g) => g.id !== id)
    setGroups(next)
    saveStoredWhatsAppGroups(next)
    onGroupsUpdated?.(next)
  }

  const handleResetGroups = () => {
    if (confirm('Réinitialiser les groupes aux valeurs par défaut ?')) {
      setGroups(DEFAULT_WHATSAPP_GROUPS)
      saveStoredWhatsAppGroups(DEFAULT_WHATSAPP_GROUPS)
      onGroupsUpdated?.(DEFAULT_WHATSAPP_GROUPS)
    }
  }

  const handleSaveTemplate = () => {
    if (!templateTitle.trim() || !templateContent.trim()) return

    let next: WhatsAppTemplate[]
    if (editingTemplateId && editingTemplateId !== 'new') {
      next = templates.map((t) =>
        t.id === editingTemplateId
          ? { ...t, title: templateTitle.trim(), content: templateContent }
          : t,
      )
    } else {
      const newTpl: WhatsAppTemplate = {
        id: `tpl-${Date.now()}`,
        title: templateTitle.trim(),
        category: 'custom',
        icon: '📝',
        content: templateContent,
      }
      next = [...templates, newTpl]
    }

    setTemplates(next)
    saveStoredWhatsAppTemplates(next)
    setEditingTemplateId(null)
    setTemplateTitle('')
    setTemplateContent('')
  }

  const handleDeleteTemplate = (id: string) => {
    const next = templates.filter((t) => t.id !== id)
    setTemplates(next)
    saveStoredWhatsAppTemplates(next)
  }

  const handleResetTemplates = () => {
    if (confirm('Réinitialiser les modèles aux valeurs par défaut ?')) {
      setTemplates(DEFAULT_WHATSAPP_TEMPLATES)
      saveStoredWhatsAppTemplates(DEFAULT_WHATSAPP_TEMPLATES)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm animate-in fade-in">
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-3xl border-2 border-[#e0bd43]/60 bg-[#0f1b3b] text-white shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#101b40] to-[#1a2d6b] px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Paramétrage WhatsApp</p>
            <h3 className="text-lg font-black">Groupes &amp; Messages types</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex size-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
          >
            <X className="size-5" />
          </button>
        </header>

        {/* Navigation sous-onglets */}
        <div className="flex border-b border-white/10 bg-white/[0.03] px-4 pt-2">
          <button
            type="button"
            onClick={() => { setActiveTab('groups'); setEditingGroupId(null); }}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'groups'
                ? 'border-[#e0bd43] text-amber-300'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Users className="size-4" />
            Groupes WhatsApp ({groups.length})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('templates'); setEditingTemplateId(null); }}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
              activeTab === 'templates'
                ? 'border-[#e0bd43] text-amber-300'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <MessageSquare className="size-4" />
            Modèles de messages ({templates.length})
          </button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeTab === 'groups' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/70">
                  Définissez vos groupes WhatsApp (ex : parents E1, E2, staff, etc.).
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetGroups}
                    className="inline-flex items-center gap-1 rounded-xl bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/60 hover:bg-white/10 hover:text-white transition"
                    title="Réinitialiser les groupes par défaut"
                  >
                    <RotateCcw className="size-3" /> Réinitialiser
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGroupId('new')
                      setGroupName('')
                      setGroupTeamFilter('both')
                      setGroupChatLink('')
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#e0bd43] px-3 py-1.5 text-xs font-bold text-[#101b40] shadow hover:bg-amber-300 transition"
                  >
                    <Plus className="size-3.5" /> Nouveau groupe
                  </button>
                </div>
              </div>

              {/* Formulaire édition / ajout groupe */}
              {editingGroupId && (
                <div className="rounded-2xl border border-amber-400/40 bg-white/5 p-4 space-y-3 animate-in fade-in">
                  <h4 className="text-xs font-black uppercase text-amber-300">
                    {editingGroupId === 'new' ? 'Ajouter un groupe' : 'Modifier le groupe'}
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-white/70 mb-1">
                        Nom du groupe *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex : 🔵 U11 - Équipe 1"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        className="w-full rounded-xl border border-white/20 bg-[#101c41] px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-white/70 mb-1">
                        Équipe associée
                      </label>
                      <select
                        value={groupTeamFilter}
                        onChange={(e) => setGroupTeamFilter(e.target.value as 'E1' | 'E2' | 'both' | 'none')}
                        className="w-full rounded-xl border border-white/20 bg-[#101c41] px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-300"
                      >
                        <option value="E1">Équipe 1 (E1)</option>
                        <option value="E2">Équipe 2 (E2)</option>
                        <option value="both">Toute la catégorie (E1 + E2)</option>
                        <option value="none">Staff / Sans équipe spécifique</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/70 mb-1">
                      Lien d’invitation WhatsApp du groupe (facultatif)
                    </label>
                    <input
                      type="url"
                      placeholder="https://chat.whatsapp.com/..."
                      value={groupChatLink}
                      onChange={(e) => setGroupChatLink(e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-[#101c41] px-3 py-2 text-xs text-white outline-none focus:border-amber-300"
                    />
                    <p className="mt-1 text-[10px] text-white/50">
                      Permet d’accéder directement à la conversation du groupe si configuré.
                    </p>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingGroupId(null)}
                      className="rounded-xl px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveGroup}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-1.5 text-xs font-black text-white shadow hover:bg-emerald-400"
                    >
                      <Check className="size-3.5" /> Enregistrer
                    </button>
                  </div>
                </div>
              )}

              {/* Liste des groupes */}
              <div className="space-y-2">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 hover:bg-white/[0.07] transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white truncate">{group.name}</span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                          {group.teamFilter === 'E1'
                            ? 'Équipe 1'
                            : group.teamFilter === 'E2'
                              ? 'Équipe 2'
                              : group.teamFilter === 'both'
                                ? 'Catégorie complète'
                                : 'Staff'}
                        </span>
                      </div>
                      {group.chatLink && (
                        <a
                          href={group.chatLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-sky-300 hover:underline"
                        >
                          <ExternalLink className="size-3" /> Lien d’invitation WhatsApp
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGroupId(group.id)
                          setGroupName(group.name)
                          setGroupTeamFilter(group.teamFilter)
                          setGroupChatLink(group.chatLink || '')
                        }}
                        className="flex size-8 items-center justify-center rounded-xl bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                        title="Modifier"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(group.id)}
                        className="flex size-8 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 hover:text-rose-200"
                        title="Supprimer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/70">
                  Modèles types pré-remplis avec variables dynamiques (ex : <code>{'{adversaire}'}</code>, <code>{'{date}'}</code>).
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetTemplates}
                    className="inline-flex items-center gap-1 rounded-xl bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/60 hover:bg-white/10 hover:text-white transition"
                    title="Réinitialiser les modèles par défaut"
                  >
                    <RotateCcw className="size-3" /> Réinitialiser
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTemplateId('new')
                      setTemplateTitle('')
                      setTemplateContent('')
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#e0bd43] px-3 py-1.5 text-xs font-bold text-[#101b40] shadow hover:bg-amber-300 transition"
                  >
                    <Plus className="size-3.5" /> Nouveau modèle
                  </button>
                </div>
              </div>

              {/* Formulaire édition / ajout modèle */}
              {editingTemplateId && (
                <div className="rounded-2xl border border-amber-400/40 bg-white/5 p-4 space-y-3 animate-in fade-in">
                  <h4 className="text-xs font-black uppercase text-amber-300">
                    {editingTemplateId === 'new' ? 'Ajouter un modèle de message' : 'Modifier le modèle'}
                  </h4>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/70 mb-1">
                      Titre du modèle *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex : Rappel tournoi"
                      value={templateTitle}
                      onChange={(e) => setTemplateTitle(e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-[#101c41] px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/70 mb-1">
                      Contenu du message *
                    </label>
                    <textarea
                      rows={6}
                      value={templateContent}
                      onChange={(e) => setTemplateContent(e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-[#101c41] p-3 text-xs text-white outline-none focus:border-amber-300 font-mono leading-relaxed"
                    />
                    <p className="mt-1 text-[10px] text-white/50">
                      Variables utilisables : {'{equipe}'}, {'{adversaire}'}, {'{date}'}, {'{competition}'}, {'{lieu}'}, {'{heure_match}'}, {'{heure_rdv}'}, {'{convoques}'}, {'{sac}'}, {'{score}'}
                    </p>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingTemplateId(null)}
                      className="rounded-xl px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-1.5 text-xs font-black text-white shadow hover:bg-emerald-400"
                    >
                      <Check className="size-3.5" /> Enregistrer
                    </button>
                  </div>
                </div>
              )}

              {/* Liste des modèles */}
              <div className="space-y-2">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 space-y-2 hover:bg-white/[0.07] transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{tpl.icon || '📝'}</span>
                        <span className="font-bold text-sm text-white">{tpl.title}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTemplateId(tpl.id)
                            setTemplateTitle(tpl.title)
                            setTemplateContent(tpl.content)
                          }}
                          className="flex size-8 items-center justify-center rounded-xl bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                          title="Modifier"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(tpl.id)}
                          className="flex size-8 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 hover:text-rose-200"
                          title="Supprimer"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded-xl bg-black/25 p-2 font-mono text-[10px] text-white/70 leading-relaxed">
                      {tpl.content}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
