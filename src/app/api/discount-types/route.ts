import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { 
  getAllDiscountTypes, 
  getActiveDiscountTypes,
  getDiscountTypeByCode,
  createDiscountType, 
  updateDiscountType,
  updateDiscountTypeByCode,
  deleteDiscountType,
  type DiscountTypeRecord
} from '@/lib/db';

// 从URL中解析jsessionid
async function resolveJsessionId(url: string): Promise<{
  success: boolean;
  jsessionid?: string;
  refererUrl?: string;
  postParams?: string;
  error?: string;
}> {
  try {
    // 发送请求获取302重定向
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15',
      },
    });

    // 检查是否是302重定向
    if (response.status === 302 || response.status === 301) {
      const location = response.headers.get('Location');
      if (!location) {
        return { success: false, error: '未获取到重定向URL' };
      }

      // 从重定向URL中提取jsessionid
      // 格式可能是: http://xxx;jsessionid=ABC123?xxx 或 http://xxx?jsessionid=ABC123&xxx
      let jsessionid = '';
      const semicolonMatch = location.match(/;jsessionid=([A-Za-z0-9]+)/i);
      const queryMatch = location.match(/[?&]jsessionid=([A-Za-z0-9]+)/i);
      
      if (semicolonMatch) {
        jsessionid = semicolonMatch[1];
      } else if (queryMatch) {
        jsessionid = queryMatch[1];
      }

      if (!jsessionid) {
        return { success: false, error: '未能从重定向URL中提取jsessionid' };
      }

      // 提取URL参数作为POST参数
      const urlObj = new URL(location);
      const postParams: Record<string, string> = {};
      const paramKeys = ['id', 'businessid', 'parkid', 'totalcount', 'adposid'];
      
      for (const key of paramKeys) {
        const value = urlObj.searchParams.get(key);
        if (value) {
          postParams[key] = value;
        }
      }

      return {
        success: true,
        jsessionid,
        refererUrl: location,
        postParams: Object.keys(postParams).length > 0 ? JSON.stringify(postParams) : undefined,
      };
    }

    // 如果不是重定向，尝试直接从URL中提取jsessionid
    const directMatch = url.match(/jsessionid=([A-Za-z0-9]+)/i);
    if (directMatch) {
      return {
        success: true,
        jsessionid: directMatch[1],
        refererUrl: url,
      };
    }

    return { success: false, error: `服务器返回状态码 ${response.status}，未进行重定向` };
  } catch (error) {
    console.error('解析jsessionid失败:', error);
    return { success: false, error: '请求失败，请检查URL是否正确' };
  }
}

// GET - 获取所有优惠类型
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    
    // 检查是否请求活跃优惠类型或用户未登录
    const activeOnly = request.nextUrl.searchParams.get('activeOnly') === 'true';
    
    let discountTypesList: DiscountTypeRecord[];
    
    if (activeOnly || !user) {
      discountTypesList = await getActiveDiscountTypes();
    } else {
      discountTypesList = await getAllDiscountTypes();
    }

    return NextResponse.json({
      success: true,
      discountTypes: discountTypesList,
    });
  } catch (error) {
    console.error('获取优惠类型失败:', error);
    return NextResponse.json(
      { success: false, error: '获取优惠类型失败' },
      { status: 500 }
    );
  }
}

// POST - 创建新优惠类型 或 更新优惠类型配置（URL/jsessionid）
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    // 更新优惠类型的URL配置（设置扫码链接）
    if (action === 'updateUrl') {
      const { code, scanUrl } = body;
      
      if (!code || !scanUrl) {
        return NextResponse.json(
          { success: false, error: '缺少必要参数' },
          { status: 400 }
        );
      }

      // 验证优惠类型是否存在
      const discountType = await getDiscountTypeByCode(code);
      if (!discountType) {
        return NextResponse.json(
          { success: false, error: '优惠类型不存在' },
          { status: 404 }
        );
      }

      // 解析URL获取jsessionid
      const resolveResult = await resolveJsessionId(scanUrl);
      
      if (!resolveResult.success) {
        return NextResponse.json({
          success: false,
          error: resolveResult.error || '获取Session ID失败',
        });
      }

      // 更新优惠类型配置
      await updateDiscountTypeByCode(code, {
        scanUrl,
        jsessionid: resolveResult.jsessionid,
        refererUrl: resolveResult.refererUrl,
        postParams: resolveResult.postParams,
      });

      return NextResponse.json({
        success: true,
        message: 'URL配置已更新',
        jsessionid: resolveResult.jsessionid,
      });
    }

    // 创建新优惠类型


    // ???????/????
    if (action === 'updateCustom') {
      const { code, requestTemplate, responseTemplate } = body;
      if (!code) {
        return NextResponse.json(
          { success: false, error: '??????' },
          { status: 400 }
        );
      }

      const discountType = await getDiscountTypeByCode(code);
      if (!discountType) {
        return NextResponse.json(
          { success: false, error: '???????' },
          { status: 404 }
        );
      }

      await updateDiscountTypeByCode(code, {
        requestTemplate: typeof requestTemplate === 'string' ? requestTemplate : null,
        responseTemplate: typeof responseTemplate === 'string' ? responseTemplate : null,
      });

      return NextResponse.json({
        success: true,
        message: '????????',
      });
    }

    if (action === 'create') {
      const { code, name, description, color } = body;
      
      if (!code || !name) {
        return NextResponse.json(
          { success: false, error: '请填写类型代码和名称' },
          { status: 400 }
        );
      }

      if (code === 'none') {
        return NextResponse.json(
          { success: false, error: 'Code "none" is reserved' },
          { status: 400 }
        );
      }

      // 检查code是否已存在
      const existing = await getDiscountTypeByCode(code);
      if (existing) {
        return NextResponse.json(
          { success: false, error: '该类型代码已存在' },
          { status: 400 }
        );
      }

      // 获取当前最大排序号
      const allTypes = await getAllDiscountTypes();
      const maxOrder = Math.max(...allTypes.map(t => t.sortOrder || 0), 0);

      const newType = await createDiscountType({
        code,
        name,
        description,
        color: color || 'orange',
        sortOrder: maxOrder + 1,
      });

      if (!newType) {
        return NextResponse.json(
          { success: false, error: '创建失败' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: '优惠类型创建成功',
        discountType: newType,
      });
    }

    return NextResponse.json(
      { success: false, error: '未知操作' },
      { status: 400 }
    );
  } catch (error) {
    console.error('操作优惠类型失败:', error);
    return NextResponse.json(
      { success: false, error: '操作失败' },
      { status: 500 }
    );
  }
}

// PUT - 更新优惠类型基本信息
export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, name, description, color, sortOrder, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少ID' },
        { status: 400 }
      );
    }

    await updateDiscountType(id, {
      name,
      description,
      color,
      sortOrder,
      isActive,
    });

    return NextResponse.json({
      success: true,
      message: '更新成功',
    });
  } catch (error) {
    console.error('更新优惠类型失败:', error);
    return NextResponse.json(
      { success: false, error: '更新失败' },
      { status: 500 }
    );
  }
}

// DELETE - 删除优惠类型
export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: '缺少类型代码' },
        { status: 400 }
      );
    }

    // 获取优惠类型
    const discountType = await getDiscountTypeByCode(code);
    if (!discountType) {
      return NextResponse.json(
        { success: false, error: '优惠类型不存在' },
        { status: 404 }
      );
    }

    // 系统内置类型不能删除
    if (discountType.isSystem) {
      return NextResponse.json(
        { success: false, error: '系统内置类型不能删除' },
        { status: 400 }
      );
    }

    const result = await deleteDiscountType(discountType.id);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('删除优惠类型失败:', error);
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 }
    );
  }
}
