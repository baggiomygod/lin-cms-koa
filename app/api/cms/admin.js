"use strict";

const {
  LinRouter,
  paginate,
  routeMetaInfo,
  adminRequired,
  Success,
  ParametersException,
  NotFound,
  Failed
} = require("lin-cms");

const { has, set, get, toSafeInteger, isInteger } = require("lodash");
const {
  ResetPasswordValidator,
  UpdateUserInfoValidator,
  NewGroupValidator,
  UpdateGroupValidator,
  DispatchAuthValidator,
  DispatchAuthsValidator,
  RemoveAuthsValidator
} = require("../../validators/cms");
const { getSafeParamId } = require("../../libs/util");
const { AdminDao } = require("../../dao/admin");

const admin = new LinRouter({
  prefix: "/cms/admin"
});

exports.admin = admin;

const adminDao = new AdminDao();

admin.linGet(
  "getAuthority",
  "/authority",
  {
    auth: "查询所有可分配的权限",
    module: "管理员",
    mount: false
  },
  adminRequired,
  ctx => {
    const res = {};
    routeMetaInfo.forEach((v, k) => {
      const au = v["auth"];
      if (!has(res, `${v["module"]}.${au}`)) {
        set(res, `${v["module"]}.${au}`, [k]);
      } else {
        res[v["module"]][au].push(k);
      }
    });
    ctx.json(res);
  }
);

admin.linGet(
  "getAdminUsers",
  "/users",
  {
    auth: "查询所有用户",
    module: "管理员",
    mount: false
  },
  adminRequired,
  async ctx => {
    const groupId = get(ctx.request.query, "group_id");
    const { start, count } = paginate(ctx);
    const { users, total } = await adminDao.getUsers(
      ctx,
      groupId,
      start,
      count
    );
    ctx.json({
      collection: users,
      // 超级管理员不算入总数
      total_nums: total
    });
  }
);

admin.linPut(
  "changeUserPassword",
  "/password/:id",
  {
    auth: "修改用户密码",
    module: "管理员",
    mount: false
  },
  adminRequired,
  async ctx => {
    const v = await new ResetPasswordValidator().validate(ctx);
    const id = toSafeInteger(get(ctx.params, "id"));
    if (!isInteger(id)) {
      throw new ParametersException({
        msg: "路由参数错误"
      });
    }
    await adminDao.changeUserPassword(ctx, v, id);
    ctx.json(
      new Success({
        msg: "密码修改成功"
      })
    );
  }
);

admin.linDelete(
  "deleteUser",
  "/:id",
  {
    auth: "删除用户",
    module: "管理员",
    mount: false
  },
  adminRequired,
  async ctx => {
    const id = toSafeInteger(get(ctx.params, "id"));
    if (!isInteger(id)) {
      throw new ParametersException({
        msg: "路由参数错误"
      });
    }
    await adminDao.deleteUser(ctx, id);
    ctx.json(
      new Success({
        msg: "操作成功"
      })
    );
  }
);

admin.linPut(
  "updateUser",
  "/:id",
  {
    auth: "管理员更新用户信息",
    module: "管理员",
    mount: false
  },
  adminRequired,
  async ctx => {
    const v = await new UpdateUserInfoValidator().validate(ctx);
    const id = toSafeInteger(get(ctx.params, "id"));
    if (!isInteger(id)) {
      throw new ParametersException({
        msg: "路由参数错误"
      });
    }
    await adminDao.updateUserInfo(ctx, v, id);
    ctx.json(
      new Success({
        msg: "操作成功"
      })
    );
  }
);

admin.linGet(
  "getAdminGroups",
  "/groups",
  {
    auth: "查询所有权限组及其权限",
    module: "管理员",
    mount: false
  },
  adminRequired,
  async ctx => {
    const { start, count } = paginate(ctx);
    const { groups, total } = await adminDao.getGroups(ctx, start, count);
    if (total < 1) {
      throw new NotFound({
        msg: "未找到任何权限组"
      });
    }
    ctx.json({
      collection: groups,
      total_nums: total
    });
  }
);

admin.linGet(
  "getAllGroup",
  "/group/all",
  {
    auth: "查询所有权限组",
    module: "管理员",
    mount: false
  },
  adminRequired,
  async ctx => {
    const groups = await ctx.manager.groupModel.findAll();
    if (!groups || groups.length < 1) {
      throw new NotFound({
        msg: "未找到任何权限组"
      });
    }
    ctx.json(groups);
  }
);

admin.linGet(
  "getGroup",
  "/group/:id",
  {
    auth: "查询一个权限组及其权限",
    module: "管理员",
    mount: false
  },
  adminRequired,
  async ctx => {
    const id = toSafeInteger(get(ctx.params, "id"));
    if (!isInteger(id)) {
      throw new ParametersException({
        msg: "路由参数错误"
      });
    }
    const group = await adminDao.getGroup(ctx, id);
    ctx.json(group);
  }
);

admin.linPost(
  "createGroup",
  "/group",
  {
    auth: "新建权限组",
    module: "管理员",
    mount: false
  },
  adminRequired,
  async ctx => {
    const v = await new NewGroupValidator().validate(ctx);
    const ok = await adminDao.createGroup(ctx, v);
    if (!ok) {
      ctx.json(
        new Failed({
          msg: "新建分组失败"
        })
      );
    } else {
      ctx.json(
        new Success({
          msg: "新建分组成功"
        })
      );
    }
  }
);

admin.linPut(
  "updateGroup",
  "/group/:id",
  {
    auth: "更新一个权限组",
    module: "管理员",
    mount: false
  },
  adminRequired,
  async ctx => {
    const v = await new UpdateGroupValidator().validate(ctx);
    const id = getSafeParamId(ctx);
    await adminDao.updateGroup(ctx, v, id);
    ctx.json(
      new Success({
        msg: "更新分组成功"
      })
    );
  }
);

admin.linDelete(
  "deleteGroup",
  "/group/:id",
  {
    auth: "删除一个权限组",
    module: "管理员",
    mount: false
  },
  adminRequired,
  async ctx => {
    const id = getSafeParamId(ctx);
    await adminDao.deleteGroup(ctx, id);
    ctx.json(
      new Success({
        msg: "删除分组成功"
      })
    );
  }
);

admin.linPost(
  "dispatchAuth",
  "/dispatch",
  {
    auth: "分配单个权限",
    module: "管理员",
    mount: false
  },
  adminRequired,
  async ctx => {
    const v = await new DispatchAuthValidator().validate(ctx);
    await adminDao.dispatchAuth(ctx, v);
    ctx.json(
      new Success({
        msg: "添加权限成功"
      })
    );
  }
);

admin.linPost(
  "dispatchAuths",
  "/dispatch/patch",
  {
    auth: "分配多个权限",
    module: "管理员",
    mount: false
  },
  adminRequired,
  async ctx => {
    const v = await new DispatchAuthsValidator().validate(ctx);
    await adminDao.dispatchAuths(ctx, v);
    ctx.json(
      new Success({
        msg: "添加权限成功"
      })
    );
  }
);

admin.linPost(
  "removeAuths",
  "/remove",
  {
    auth: "删除多个权限",
    module: "管理员",
    mount: false
  },
  adminRequired,
  async ctx => {
    const v = await new RemoveAuthsValidator().validate(ctx);
    await adminDao.removeAuths(ctx, v);
    ctx.json(
      new Success({
        msg: "删除权限成功"
      })
    );
  }
);
