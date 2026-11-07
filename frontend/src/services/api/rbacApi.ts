import {
  PermissionMatrixDto,
  UserDto,
  UpdateRolePermissionRequest,
  AssignUserRoleRequest,
  InviteUserRequest,
} from "../../types/index";

// MOCK reference data only; not the backend authorization policy.

const mockPermissionMatrix: PermissionMatrixDto = {
  roles: [
    { roleId: "admin", roleName: "admin" },
    { roleId: "manager", roleName: "manager" },
    { roleId: "staff", roleName: "staff" },
  ],
  categories: [
    {
      categoryName: "warehouse",
      permissions: [
        {
          permissionId: 1,
          name: "Quản lý kiểm kê & điều chỉnh tồn kho",
          permissionKey: "manage_inventory",
          roleAccess: { admin: true, manager: true, staff: false },
        },
        {
          permissionId: 2,
          name: "Phê duyệt chứng từ Nhập / Xuất",
          permissionKey: "approve_orders",
          roleAccess: { admin: true, manager: true, staff: false },
        },
        {
          permissionId: 3,
          name: "Quét mã vạch hiện trường (PDA)",
          permissionKey: "scan_barcodes",
          roleAccess: { admin: true, manager: true, staff: true },
        },
      ],
    },
    {
      categoryName: "master_data",
      permissions: [
        {
          permissionId: 4,
          name: "Quản lý danh mục sản phẩm & Ô kệ",
          permissionKey: "manage_master_data",
          roleAccess: { admin: true, manager: true, staff: false },
        },
      ],
    },
    {
      categoryName: "system",
      permissions: [
        {
          permissionId: 5,
          name: "Truy xuất nhật ký hoạt động & An ninh",
          permissionKey: "view_audit_logs",
          roleAccess: { admin: true, manager: true, staff: false },
        },
        {
          permissionId: 6,
          name: "Cấu hình chính sách hệ thống",
          permissionKey: "system_configuration",
          roleAccess: { admin: true, manager: false, staff: false },
        },
      ],
    },
  ],
};

const mockUsers: UserDto[] = [
  {
    id: "1",
    name: "Thanh Nguyen",
    email: "thanh.n@smartwms.com",
    avatar: "TN",
    role: "admin",
    warehouse: "Tổng Kho Trung Tâm - WH-01",
  },
  {
    id: "2",
    name: "Minh Le",
    email: "minh.le@smartwms.com",
    avatar: "ML",
    role: "manager",
    warehouse: "Kho Vệ Tinh Bình Dương - WH-02",
  },
  {
    id: "3",
    name: "Khoa Pham",
    email: "khoa.p@smartwms.com",
    avatar: "KP",
    role: "staff",
    warehouse: "Tổng Kho Trung Tâm - WH-01",
  },
  {
    id: "4",
    name: "Ly Tran",
    email: "ly.tran@smartwms.com",
    avatar: "LT",
    role: "staff",
    warehouse: "Kho Vệ Tinh Bình Dương - WH-02",
  },
  {
    id: "5",
    name: "Nguyễn Văn Hùng",
    email: "hung.nv@smartwms.com",
    avatar: "NH",
    role: "staff",
    warehouse: "Tổng Kho Trung Tâm - WH-01",
  },
  {
    id: "6",
    name: "Trần Anh Tuấn",
    email: "tuan.ta@smartwms.com",
    avatar: "TT",
    role: "manager",
    warehouse: "Tổng Kho Trung Tâm - WH-01",
  },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const rbacApi = {
  getPermissionMatrix: async (): Promise<PermissionMatrixDto> => {
    await delay(300);
    return JSON.parse(JSON.stringify(mockPermissionMatrix));
  },

  updateRolePermission: async (
    req: UpdateRolePermissionRequest
  ): Promise<{ success: boolean; message: string }> => {
    await delay(200);
    return { success: false, message: "Mutation not supported by backend policy" };
  },

  getUsers: async (): Promise<UserDto[]> => {
    await delay(250);
    return JSON.parse(JSON.stringify(mockUsers));
  },

  assignUserRole: async (
    req: AssignUserRoleRequest
  ): Promise<{ success: boolean; message: string }> => {
    await delay(200);
    return { success: false, message: "Role mutation not supported by backend policy" };
  },

  inviteUser: async (
    req: InviteUserRequest
  ): Promise<{ success: boolean; message: string }> => {
    await delay(200);
    return { success: false, message: "User invitation not supported by backend policy" };
  },

  checkZoneEfficiency: async (): Promise<import("../../types").CheckZoneEfficiencyResponse | null> => {
    return null;
  },
};
