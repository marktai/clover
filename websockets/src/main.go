package main

import (
	"flag"
	"marktai.com/websockets/server"
)

func main() {
	var port int

	flag.IntVar(&port, "port", 80, "Port the server listens to")

	flag.Parse()

	server.Run(port)
}
