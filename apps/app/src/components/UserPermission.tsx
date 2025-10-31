import { Button } from "./ui/button";

const PermissionRequest = ({
  toolName,
  args,
  onAllow,
  onDeny,
}: {
  toolName: string;
  args: any;
  onAllow: () => void;
  onDeny: () => void;
}) => {
  return (
    <div className="flex flex-col gap-2 border border-muted-foreground/20 rounded-md p-2 mt-2 bg-muted/30">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Tool <b>{toolName}</b> requests permission
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs text-green-600 border-green-500/40"
            onClick={onAllow}
          >
            Allow
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs text-red-600 border-red-500/40"
            onClick={onDeny}
          >
            Deny
          </Button>
        </div>
      </div>

      {args && Object.keys(args).length > 0 ? (
        <pre className="text-[11px] bg-muted/40 text-muted-foreground p-2 rounded-md overflow-x-auto max-h-40 whitespace-pre-wrap">
          {JSON.stringify(args, null, 2)}
        </pre>
      ) : (
        <span className="text-[11px] text-muted-foreground/60 italic">
          No arguments provided
        </span>
      )}
    </div>
  );
};

export default PermissionRequest;
