/* eslint-disable @next/next/no-img-element */
import { useState } from "react"
import { Button } from "./ui/button"
import { ScrollArea } from "./ui/scroll-area"
import { getTemplatesByCategory, Template } from "@/lib/utils/templates"
import { Badge } from "./ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"

interface TemplatePopUPProps {
    toggleTemplate: () => void;
    onSelectTemplate: (jobDefinition: Record<string, any>) => void;
}

export function TemplatePopUP({ toggleTemplate, onSelectTemplate }: TemplatePopUPProps) {
    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4"
            onClick={() => toggleTemplate()}
        >
            <div
                className="p-6 bg-background rounded-xl border shadow-2xl w-full max-w-7xl h-[80vh] max-h-[90vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-foreground mb-2">Deployment Templates</h1>
                    <p className="text-sm text-muted-foreground">
                        Select a template to quickly deploy pre-configured containers on Nosana
                    </p>
                </div>

                <ModelGroups onSelectTemplate={onSelectTemplate} toggleTemplate={toggleTemplate} />
            </div>
        </div>
    )
}

interface ModelGroupsProps {
    onSelectTemplate: (jobDefinition: Record<string, any>) => void;
    toggleTemplate: () => void;
}

export function ModelGroups({ onSelectTemplate, toggleTemplate }: ModelGroupsProps) {
    const templatesByCategory = getTemplatesByCategory();

    const handleSelectTemplate = (jobDefinition: Record<string, any>) => {
        onSelectTemplate(jobDefinition);
        toggleTemplate();
    };

    return (
        <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full w-full">
                <div className="space-y-8 pr-4 pb-4">
                    {Object.entries(templatesByCategory).map(([category, templates]) => (
                        <div key={category}>
                            <div className="flex items-center gap-2 mb-4">
                                <h2 className="text-lg font-semibold text-foreground">{category}</h2>
                                <Badge variant="secondary" className="text-xs">
                                    {templates.length}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {templates.map((template) => (
                                    <TemplateCard
                                        key={template.id}
                                        template={template}
                                        onSelectTemplate={handleSelectTemplate}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    )
}

interface TemplateCardProps {
    template: Template;
    onSelectTemplate: (jobDefinition: Record<string, any>) => void;
}

function TemplateCard({ template, onSelectTemplate }: TemplateCardProps) {
    const hasVariants = template.variants && template.variants.length > 0;
    const [selectedVariantId, setSelectedVariantId] = useState<string>("");

    const handleDeploy = () => {
        if (hasVariants && selectedVariantId) {
            const variant = template.variants!.find(v => v.id === selectedVariantId);
            if (variant) {
                onSelectTemplate(variant.jobDefinition);
            }
        } else if (!hasVariants && template.jobDefinition) {
            onSelectTemplate(template.jobDefinition);
        }
    };

    return (
        <div className="w-full">
            <div className="h-full bg-card rounded-lg border border-border hover:border-primary/50 transition-all p-4 flex flex-col justify-between shadow-sm hover:shadow-md">
                <div className="space-y-3">
                    {/* Header with icon and title */}
                    <div className="flex items-start gap-3">
                        <div className="h-14 w-14 flex-shrink-0 flex items-center justify-center rounded-lg bg-muted overflow-hidden border">
                            {template.icon ? (
                                <img
                                    src={template.icon}
                                    alt={template.name}
                                    className="h-full w-full object-contain p-1"
                                />
                            ) : (
                                <div className="text-xl font-bold text-muted-foreground">
                                    {template.name.charAt(0)}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-foreground truncate">
                                {template.name}
                            </h3>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {template.category.slice(0, 2).map((cat) => (
                                    <Badge key={cat} variant="outline" className="text-xs">
                                        {cat}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Variant selector */}
                    {hasVariants && (
                        <div className="pt-2">
                            <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a variant" />
                                </SelectTrigger>
                                <SelectContent>
                                    {template.variants!.map((variant) => (
                                        <SelectItem key={variant.id} value={variant.id} title={variant.description}>
                                            {variant.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {/* Deploy button */}
                <Button
                    size="sm"
                    variant="default"
                    onClick={handleDeploy}
                    disabled={hasVariants && !selectedVariantId}
                    className="mt-4 w-full"
                >
                    Deploy
                </Button>
            </div>
        </div>
    );
}
