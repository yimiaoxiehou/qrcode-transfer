package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

//go:embed build
var front embed.FS

// 读取响应体并解析JSON
type TokenResult struct {
	Errcode     int    `json:"errcode"`
	Errmsg      string `json:"errmsg"`
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
}

func main() {
	corpid := "ww0f642810a65d6cb8"
	corpsecret := "H4oKUT6i8XZ9B4RQXjU2bSDzid13tnxQsQu_NPPpras"

	accessToken, err := getAccessToken(corpid, corpsecret)
	if err != nil {
		fmt.Errorf("获取access_token失败:", err)
	}

	// 初始化Gin框架
	r := gin.Default()
	folder, _ := static.EmbedFolder(front, "build")
	r.Use(static.Serve("/", folder))
	r.NoRoute(func(c *gin.Context) {
		accept := c.Request.Header.Get("Accept")
		flag := strings.Contains(accept, "text/html")
		if flag {
			content, err := front.ReadFile("build/index.html")
			if (err) != nil {
				c.Writer.WriteHeader(404)
				c.Writer.WriteString("Not Found")
				return
			}
			c.Writer.WriteHeader(200)
			c.Writer.Header().Add("Accept", "text/html")
			c.Writer.Write((content))
			c.Writer.Flush()
		}
	})

	// 添加API路由 - 需要在静态文件服务之前定义
	r.GET("/api/getJsTicket", func(c *gin.Context) {
		url := "https://qyapi.weixin.qq.com/cgi-bin/get_jsapi_ticket?access_token=" + accessToken
		method := "GET"

		client := &http.Client{}
		req, err := http.NewRequest(method, url, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "创建请求失败: " + err.Error(),
			})
			return
		}

		res, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "发送请求失败: " + err.Error(),
			})
			return
		}
		defer res.Body.Close()

		body, err := io.ReadAll(res.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "读取响应失败: " + err.Error(),
			})
			return
		}

		// 验证响应是否为有效的JSON
		var result map[string]interface{}
		if err := json.Unmarshal(body, &result); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "解析JSON失败: " + err.Error(),
			})
			return
		}

		c.Header("Content-Type", "application/json")
		c.Writer.Write(body)
	})

	// 启动服务器
	fmt.Println("服务器启动在 :8080 端口")
	r.Run(":8080")
}

func getAccessToken(corpid string, corpsecret string) (string, error) {
	url := fmt.Sprintf("https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=%s&corpsecret=%s", corpid, corpsecret)
	method := "GET"
	client := &http.Client{}
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		return "", err
	}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}

	// 读取响应体并解析JSON
	type TokenResult struct {
		Errcode     int    `json:"errcode"`
		Errmsg      string `json:"errmsg"`
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	// 解析JSON数据为结构体
	var result TokenResult

	err = json.Unmarshal(body, &result)
	if err != nil {
		return "", err
	}
	if result.Errcode != 0 {
		return "", fmt.Errorf("获取access_token失败，错误码：%d，错误信息：%s", result.Errcode, result.Errmsg)
	}
	// 提取access_token
	return result.AccessToken, nil
}
