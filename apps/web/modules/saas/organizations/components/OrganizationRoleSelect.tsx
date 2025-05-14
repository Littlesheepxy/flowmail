import type { OrganizationMemberRole } from "@repo/auth";
import { useOrganizationMemberRoles } from "@saas/organizations/hooks/member-roles";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";

export function OrganizationRoleSelect({
	value,
	onSelect,
	disabled,
}: {
	value: OrganizationMemberRole;
	onSelect: (value: OrganizationMemberRole) => void;
	disabled?: boolean;
}) {
	const organizationMemberRoles = useOrganizationMemberRoles();

	const roleOptions = Object.entries(organizationMemberRoles).map(
		([value, label]) => ({
			value,
			label,
		}),
	);

	return (
		<Select value={value} onValueChange={onSelect} disabled={disabled}>
			<SelectTrigger>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{roleOptions.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
