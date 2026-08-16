import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Clock3, Loader2, UserRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RequestStatus = "pending" | "approved" | "rejected";

type AccountRequest = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  id_number: string | null;
  address: string | null;
  notes: string | null;
  status: RequestStatus;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

export function AccountRequestsPanel() {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<AccountRequest | null>(null);
  const [reason, setReason] = useState("");

  const { data: requests = [], isLoading } = useQuery<AccountRequest[]>({
    queryKey: ["account-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AccountRequest[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc("approve_tenant_account_request", {
        p_request_id: requestId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت الموافقة وربط حساب المستأجر بنجاح");
      void qc.invalidateQueries({ queryKey: ["account-requests"] });
      void qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: Error) => toast.error(error.message || "تعذر اعتماد الطلب"),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      requestId,
      rejectionReason,
    }: {
      requestId: string;
      rejectionReason: string;
    }) => {
      const { error } = await supabase.rpc("reject_tenant_account_request", {
        p_request_id: requestId,
        p_rejection_reason: rejectionReason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم رفض طلب الحساب وتسجيل القرار");
      setRejecting(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["account-requests"] });
    },
    onError: (error: Error) => toast.error(error.message || "تعذر رفض الطلب"),
  });

  const pendingCount = requests.filter((request) => request.status === "pending").length;

  return (
    <Card className="overflow-hidden border-primary/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-primary/5 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Clock3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold">طلبات فتح حسابات المستأجرين</h2>
            <p className="text-xs text-muted-foreground">
              مراجعة الطلبات قبل ربط الحساب ببيانات المستأجر
            </p>
          </div>
        </div>
        <Badge
          className={
            pendingCount ? "bg-amber-500/20 text-amber-700" : "bg-emerald-500/20 text-emerald-700"
          }
        >
          {pendingCount ? `${pendingCount} طلب جديد` : "لا توجد طلبات معلقة"}
        </Badge>
      </div>

      {isLoading ? (
        <div className="p-8 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          ستظهر طلبات التسجيل الجديدة هنا.
        </div>
      ) : (
        <div className="divide-y">
          {requests.map((request) => (
            <div key={request.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/10 text-sky-700">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold">{request.full_name}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {request.email} · {request.phone}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    request.status === "pending"
                      ? "outline"
                      : request.status === "approved"
                        ? "default"
                        : "destructive"
                  }
                >
                  {STATUS_LABELS[request.status]}
                </Badge>
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <span>تاريخ الطلب: {format(new Date(request.created_at), "yyyy/MM/dd HH:mm")}</span>
                {request.id_number && <span>الهوية: {request.id_number}</span>}
                {request.address && <span>العنوان: {request.address}</span>}
              </div>
              {request.rejection_reason && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  سبب الرفض: {request.rejection_reason}
                </p>
              )}
              {request.status === "pending" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate(request.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="ml-1 h-4 w-4" />
                    )}
                    موافقة وربط المستأجر
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => setRejecting(request)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    <XCircle className="ml-1 h-4 w-4" /> رفض الطلب
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>رفض طلب حساب المستأجر</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>سبب الرفض (اختياري)</Label>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="اكتب سبباً واضحاً للرجوع إليه..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={!rejecting || rejectMutation.isPending}
              onClick={() =>
                rejecting &&
                rejectMutation.mutate({ requestId: rejecting.id, rejectionReason: reason })
              }
            >
              {rejectMutation.isPending && <Loader2 className="ml-1 h-4 w-4 animate-spin" />} تأكيد
              الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
