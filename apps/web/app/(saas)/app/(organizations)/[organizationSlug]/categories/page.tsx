import { PageHeader } from "@saas/shared/components/PageHeader";
import { CategoryManager } from "@flowmail/components/CategoryManager";

export const metadata = { title: "分类管理" };

export default function CategoriesPage() {
	return (
		<div>
			<PageHeader
				title="分类管理"
				subtitle="自定义邮件分类规则，配置 AI 分类提示词，管理分类展示顺序"
			/>
			<CategoryManager />
		</div>
	);
}
