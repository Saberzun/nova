package controller

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/shopspring/decimal"
)

type storeOrderEpayRequest struct {
	PaymentMethod string `json:"payment_method"`
}

func StoreOrderRequestEpay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	var request storeOrderEpayRequest
	if err := c.ShouldBindJSON(&request); err != nil || !operation_setting.ContainsPayMethod(request.PaymentMethod) {
		common.ApiErrorMsg(c, "支付方式不存在")
		return
	}
	order, err := model.PrepareProductOrderPayment(
		c.Param("order_no"),
		c.GetInt("id"),
		model.PaymentProviderEpay,
		request.PaymentMethod,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.ToUpper(order.Currency) != "CNY" {
		common.ApiErrorMsg(c, "易支付目前只支持 CNY 商品")
		return
	}
	client := GetEpayClient()
	if client == nil {
		common.ApiErrorMsg(c, "当前管理员未配置支付信息")
		return
	}
	callbackAddress := service.GetCallbackAddress()
	notifyURL, err := url.Parse(callbackAddress + "/api/store/epay/notify")
	if err != nil {
		common.ApiErrorMsg(c, "回调地址配置错误")
		return
	}
	returnURL, err := url.Parse(callbackAddress + "/api/store/epay/return")
	if err != nil {
		common.ApiErrorMsg(c, "回调地址配置错误")
		return
	}
	money := decimal.NewFromInt(order.TotalAmountMinor).Div(decimal.NewFromInt(100)).StringFixed(2)
	uri, params, err := client.Purchase(&epay.PurchaseArgs{
		Type:           request.PaymentMethod,
		ServiceTradeNo: order.OrderNo,
		Name:           "PRODUCT:" + order.OrderNo,
		Money:          money,
		Device:         epay.PC,
		NotifyUrl:      notifyURL,
		ReturnUrl:      returnURL,
	})
	if err != nil {
		common.ApiErrorMsg(c, "拉起支付失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": params, "url": uri})
}

func parseStoreEpayParams(c *gin.Context) (map[string]string, error) {
	if c.Request.Method == http.MethodPost {
		if err := c.Request.ParseForm(); err != nil {
			return nil, err
		}
		return lo.Reduce(lo.Keys(c.Request.PostForm), func(result map[string]string, key string, _ int) map[string]string {
			result[key] = c.Request.PostForm.Get(key)
			return result
		}, map[string]string{}), nil
	}
	return lo.Reduce(lo.Keys(c.Request.URL.Query()), func(result map[string]string, key string, _ int) map[string]string {
		result[key] = c.Request.URL.Query().Get(key)
		return result
	}, map[string]string{}), nil
}

func completeStoreEpay(c *gin.Context) (bool, string) {
	params, err := parseStoreEpayParams(c)
	if err != nil || len(params) == 0 {
		return false, ""
	}
	client := GetEpayClient()
	if client == nil {
		return false, ""
	}
	verifyInfo, err := client.Verify(params)
	if err != nil || !verifyInfo.VerifyStatus || verifyInfo.TradeStatus != epay.StatusTradeSuccess {
		return false, ""
	}
	payload, err := common.Marshal(verifyInfo)
	if err != nil {
		return false, verifyInfo.ServiceTradeNo
	}
	LockOrder(verifyInfo.ServiceTradeNo)
	defer UnlockOrder(verifyInfo.ServiceTradeNo)
	err = model.CompleteProductOrderWithProvider(
		verifyInfo.ServiceTradeNo,
		verifyInfo.TradeNo,
		model.PaymentProviderEpay,
		verifyInfo.Type,
		string(payload),
	)
	return err == nil, verifyInfo.ServiceTradeNo
}

func StoreEpayNotify(c *gin.Context) {
	if ok, _ := completeStoreEpay(c); ok {
		_, _ = c.Writer.Write([]byte("success"))
		return
	}
	_, _ = c.Writer.Write([]byte("fail"))
}

func StoreEpayReturn(c *gin.Context) {
	if ok, _ := completeStoreEpay(c); ok {
		c.Redirect(http.StatusFound, paymentReturnPath("/console/store?pay=success"))
		return
	}
	c.Redirect(http.StatusFound, paymentReturnPath("/console/store?pay=fail"))
}
