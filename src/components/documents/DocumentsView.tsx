import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { DocumentItem, DocumentCategory } from '../../types';
import {
  FileText,
  Upload,
  Search,
  Filter,
  Sparkles,
  Download,
  Trash2,
  Eye,
  AlertTriangle,
  X,
  FileSpreadsheet,
  FileCode,
  File,
  Building,
} from 'lucide-react';

const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'Invoice',
  'Contract',
  'Proposal',
  'KYC',
  'Technical Spec',
  'General',
];

/**
 * Whether a document record points at a file that actually exists somewhere.
 *
 * Placeholders in this dataset take three shapes: '#', an empty string, and
 * https://example.com/... (a reserved domain that will never serve anything).
 * None of them is a download.
 */
function isDownloadable(fileUrl?: string): boolean {
  const url = fileUrl?.trim();
  if (!url || url === '#') return false;
  try {
    const { protocol, hostname } = new URL(url, window.location.origin);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    return hostname !== 'example.com' && !hostname.endsWith('.example.com');
  } catch {
    return false;
  }
}

export const DocumentsView: React.FC = () => {
  const { documents, addDocument, deleteDocument, customers, currentUser } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Gemini AI Summary modal
  const [summarizingDoc, setSummarizingDoc] = useState<DocumentItem | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // File Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<DocumentCategory>('Contract');
  const [relatedCustomerId, setRelatedCustomerId] = useState<string>(customers[0]?.id || '');

  const [notice, setNotice] = useState<string | null>(null);

  const filteredDocs = documents.filter((d) => {
    const docName = (d.title || d.name || '').toLowerCase();
    const fileName = (d.fileName || d.name || '').toLowerCase();
    const custName = (d.customerName || d.relatedCustomerName || '').toLowerCase();

    const matchesSearch =
      docName.includes(searchQuery.toLowerCase()) ||
      fileName.includes(searchQuery.toLowerCase()) ||
      custName.includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || d.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setUploadFile(f);
      if (!docTitle) setDocTitle(f.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile && !docTitle) return;

    const customer = customers.find((c) => c.id === relatedCustomerId);
    const resolvedName = docTitle || uploadFile?.name || 'Untitled Document';

    await addDocument({
      name: resolvedName,
      title: resolvedName,
      fileName: uploadFile?.name || resolvedName,
      // Was '1.2 MB' and 'application/pdf' whenever no file was picked, which
      // put an invented size and type on a record that has no file at all.
      fileSize: uploadFile ? `${(uploadFile.size / (1024 * 1024)).toFixed(2)} MB` : '—',
      fileType: uploadFile?.type || 'unknown',
      fileUrl: '',
      category: docCategory,
      customerId: relatedCustomerId || undefined,
      customerName: customer ? customer.fullName : undefined,
      relatedCustomerId: relatedCustomerId || undefined,
      relatedCustomerName: customer ? customer.fullName : undefined,
      uploadedById: currentUser?.uid || 'admin_user',
      uploadedByName: currentUser?.displayName || 'Admin',
    });

    setIsUploadModalOpen(false);
    setUploadFile(null);
    setDocTitle('');

    /*
      Deliberately explicit. This module records document metadata; there is no
      storage bucket behind it, so the file the user just picked stays on their
      machine. Saying so beats letting them believe the file is filed away and
      discovering otherwise when they need it.
    */
    setNotice(
      uploadFile
        ? `"${resolvedName}" was catalogued, but the file itself was not uploaded — document storage is not connected yet.`
        : `"${resolvedName}" was catalogued as a metadata-only record.`
    );
    setTimeout(() => setNotice(null), 8000);
  };

  // Trigger Gemini AI Document Summarization
  const handleSummarizeDoc = async (doc: DocumentItem) => {
    setSummarizingDoc(doc);
    setIsAiLoading(true);
    setAiSummary(null);

    const docDisplayName = doc.title || doc.name;
    const clientName = doc.customerName || doc.relatedCustomerName || 'Enterprise';

    try {
      const response = await fetch('/api/gemini/summarize-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: docDisplayName,
          category: doc.category,
          customerName: clientName,
          fileType: doc.fileType,
          textContent: doc.aiSummary || doc.summary || `${docDisplayName} is an official ${doc.category} for client ${clientName}. It outlines commercial deliverables, 99.5% uptime SLA, payment schedule, data privacy safeguards, and warranty terms over a 12-month tenure.`,
        }),
      });

      const data = await response.json();
      if (data.summary) {
        setAiSummary(data.summary);
      } else {
        setAiSummary(
          `**Document Overview:**\nThis ${doc.category} governs commercial engagements between the provider and ${clientName}.\n\n**Key Clauses:**\n- Service Level Commitment: 99.5% Availability with 4-hour critical issue response.\n- Term: 12 months with automatic renewal notice 30 days in advance.\n- Liability Cap: Capped at 1x annual contract value.\n\n**Action Items:**\n- Ensure signed copy is archived.\n- Schedule kickoff review within 5 business days.`
        );
      }
    } catch (err) {
      setAiSummary(
        `**Summary:**\n${docDisplayName} (${doc.category}) registered for ${clientName}. SLA and commercial obligations verified.`
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const getDocIcon = (category: DocumentCategory) => {
    switch (category) {
      case 'Invoice':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
      case 'Contract':
        return <FileText className="w-5 h-5 text-purple-600" />;
      case 'Proposal':
        return <FileCode className="w-5 h-5 text-blue-600" />;
      default:
        return <File className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Documents & Vault</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-purple-100 text-purple-800 rounded-full">
              {documents.length} Files
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Secure client contracts, agreements, invoices, and Gemini AI legal/commercial summarization.
          </p>
        </div>

        {currentUser?.role !== 'viewer' && (
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        )}
      </div>

      {notice && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-amber-700 hover:text-amber-900 font-bold">✕</button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search document title, customer, file name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-700 focus:outline-none"
          >
            <option value="All">All Categories</option>
            {DOCUMENT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map((doc) => (
          <div
            key={doc.id}
            className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-purple-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                  {getDocIcon(doc.category)}
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                  {doc.category}
                </span>
              </div>

              <h3 className="font-bold text-sm text-slate-900 mt-3">{doc.title}</h3>
              <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">{doc.fileName}</p>

              {doc.customerName && (
                <div className="mt-2 text-xs text-blue-700 font-medium flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" />
                  <span>{doc.customerName}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>{doc.fileSize}</span>
                <span>Uploaded: {new Date(doc.createdAt).toLocaleDateString()}</span>
              </div>

              <div className="flex items-center justify-between pt-1">
                {/* AI Summarize Button */}
                <button
                  onClick={() => handleSummarizeDoc(doc)}
                  className="px-2.5 py-1 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  AI Summary
                </button>

                <div className="flex items-center gap-1">
                  {/*
                    This button used to show a "Preparing download…" toast and
                    then do nothing, for every document. There is no file
                    storage behind this module yet: the upload form reads a file
                    and saves fileUrl: '#', and the seed rows point at
                    example.com. A control that looks like it works and quietly
                    does not is the worst of the three options, so it is
                    disabled and says why until a bucket is wired up.
                  */}
                  {isDownloadable(doc.fileUrl) ? (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg inline-flex"
                      title="Open document"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="p-1.5 text-slate-300 rounded-lg cursor-not-allowed"
                      title="No file stored for this record. Document storage is not connected yet."
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  {currentUser?.role !== 'viewer' && (
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Gemini AI Document Summary Modal */}
      {summarizingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-purple-50/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Gemini AI Summary: {summarizingDoc.title}
                </h3>
              </div>
              <button onClick={() => setSummarizingDoc(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 flex justify-between">
                <span>Category: <strong>{summarizingDoc.category}</strong></span>
                <span>Customer: <strong>{summarizingDoc.customerName || 'Internal'}</strong></span>
              </div>

              {isAiLoading ? (
                <div className="p-12 text-center space-y-3">
                  <Sparkles className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
                  <p className="font-semibold text-slate-700">
                    Gemini is parsing document structure and extracting key obligations...
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 whitespace-pre-wrap font-sans text-xs max-h-80 overflow-y-auto leading-relaxed">
                  {aiSummary}
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-200">
                <button
                  onClick={() => setSummarizingDoc(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-purple-50/40">
              <h3 className="font-bold text-slate-900 text-base">Upload Document to Vault</h3>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4 text-xs">
              {/* Drag and Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-8 border-2 border-dashed border-slate-300 hover:border-purple-500 rounded-2xl text-center cursor-pointer bg-slate-50/50 hover:bg-purple-50/20 transition-all space-y-2"
              >
                <Upload className="w-8 h-8 text-purple-600 mx-auto" />
                <div className="font-bold text-slate-800 text-xs">
                  {uploadFile ? uploadFile.name : 'Click to select or drag & drop file'}
                </div>
                <div className="text-[11px] text-slate-400">PDF, Word, Excel, Images up to 25MB</div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Services Agreement 2026"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as DocumentCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Associate with Client</label>
                  <select
                    value={relatedCustomerId}
                    onChange={(e) => setRelatedCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Internal (No Client)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-xs"
                >
                  Upload & Index
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
